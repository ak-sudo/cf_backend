"""
CivicFlow AI service: civic issue identification, department routing, severity/fraud
assessment and field-report generation via an Agno agent on a Groq vision model.
"""
import hmac
import logging
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, status

from civic_agent import AgentFailed, AgentNotConfigured, CivicIssueAnalyzer
from config import AI_SERVICE_API_KEY, ENVIRONMENT, HOST, PORT
from image_fetcher import fetch_images
from schemas import AIReportDetail, ClassificationRequest, ClassificationResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("civicflow-ai")

if ENVIRONMENT == "production" and not AI_SERVICE_API_KEY:
    raise RuntimeError("AI_SERVICE_API_KEY must be set in production")
if not AI_SERVICE_API_KEY:
    logger.warning("AI_SERVICE_API_KEY not set - /api/v1/classify is unauthenticated (development only)")

# Internal service: no CORS (browsers never call it directly) and no public docs in production
app = FastAPI(
    title="CivicFlow AI Service",
    description="Agno agent on a Groq vision model (free tier) for civic issue identification, routing and reporting",
    version="2.0.0",
    docs_url=None if ENVIRONMENT == "production" else "/docs",
    redoc_url=None,
    openapi_url=None if ENVIRONMENT == "production" else "/openapi.json",
)

analyzer = CivicIssueAnalyzer()


def require_internal_key(x_internal_api_key: str | None = Header(default=None)) -> None:
    if not AI_SERVICE_API_KEY:
        return
    if not x_internal_api_key or not hmac.compare_digest(x_internal_api_key, AI_SERVICE_API_KEY):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing internal API key")


@app.get("/health")
def health_check():
    return {
        "status": "healthy" if analyzer.is_configured else "degraded",
        "service": "civicflow-ai-agent",
        "model": analyzer.model_version,
        "model_configured": analyzer.is_configured,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "capabilities": [
            "issue_identification",
            "department_routing",
            "severity_estimation",
            "fraud_screening",
            "report_generation",
        ],
    }


@app.post(
    "/api/v1/classify",
    response_model=ClassificationResponse,
    dependencies=[Depends(require_internal_key)],
)
async def classify_civic_issue(payload: ClassificationRequest):
    if not analyzer.is_configured:
        raise HTTPException(status_code=503, detail="AI model is not configured (missing GROQ_API_KEY)")

    logger.info("Analyzing report_id=%s images=%d", payload.report_id, len(payload.image_urls))

    images, rejections = await fetch_images([str(u) for u in payload.image_urls])
    if not images:
        raise HTTPException(
            status_code=422,
            detail={"message": "None of the submitted images could be used", "reasons": rejections},
        )

    try:
        result = await analyzer.analyze(
            title=payload.title,
            description=payload.description,
            images=images,
            images_rejected=len(rejections),
        )
    except AgentNotConfigured:
        raise HTTPException(status_code=503, detail="AI model is not configured (missing GROQ_API_KEY)")
    except AgentFailed as exc:
        # Log the cause server-side; return a generic message (no internals / keys leak to callers)
        logger.error("Agent failure for report_id=%s: %s", payload.report_id, exc, exc_info=exc.__cause__)
        raise HTTPException(status_code=502, detail="AI analysis failed; please retry later")

    logger.info(
        "Report %s -> %s / %s / %s (confidence=%.2f, fraud=%.2f, flags=%s)",
        payload.report_id,
        result["predicted_category"],
        result["recommended_department"],
        result["severity"],
        result["confidence"],
        result["fraud_score"],
        result["guardrail_flags"],
    )

    return ClassificationResponse(
        success=True,
        report_id=payload.report_id,
        predicted_category=result["predicted_category"],
        recommended_department=result["recommended_department"],
        severity=result["severity"],
        severity_score=result["severity_score"],
        confidence=result["confidence"],
        fraud_score=result["fraud_score"],
        ai_report=AIReportDetail(**result["ai_report"]),
        model_version=analyzer.model_version,
        processed_at=datetime.now(timezone.utc).isoformat(),
        issue_label=result["issue_label"],
        is_civic_issue=result["is_civic_issue"],
        images_analyzed=result["images_analyzed"],
        guardrail_flags=result["guardrail_flags"],
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=HOST, port=PORT, reload=ENVIRONMENT != "production")
