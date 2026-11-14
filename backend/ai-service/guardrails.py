"""
Deterministic guardrails applied to every agent output before it leaves the service.
The model's answer is treated as untrusted input: enums are re-checked, numbers clamped,
routing constrained, and text sanitised and length-limited.
"""
import re
from typing import Any, Dict, List

from config import (
    ALLOWED_CATEGORIES,
    ALLOWED_DEPARTMENTS,
    ALLOWED_SEVERITIES,
    ALLOWED_URGENCIES,
    CATEGORY_ALLOWED_DEPARTMENTS,
    CATEGORY_DEPARTMENT_ROUTING,
    SEVERITY_SCORE_RANGE,
)

MAX_TEXT = 600
MAX_ITEM = 240
MAX_ITEMS = 6

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_TAGS = re.compile(r"<[^>]{0,200}>")


def _clean_text(value: Any, limit: int, fallback: str) -> str:
    if not isinstance(value, str):
        return fallback
    text = _TAGS.sub("", _CONTROL_CHARS.sub("", value))
    text = re.sub(r"\s+", " ", text).strip()
    return (text[: limit - 1] + "…") if len(text) > limit else (text or fallback)


def _clean_list(value: Any, fallback: List[str]) -> List[str]:
    if not isinstance(value, list):
        return fallback
    items = [_clean_text(v, MAX_ITEM, "") for v in value]
    items = [i for i in items if i][:MAX_ITEMS]
    return items or fallback


def _clamp(value: Any, lo: float, hi: float, default: float) -> float:
    try:
        return max(lo, min(hi, float(value)))
    except (TypeError, ValueError):
        return default


def apply_guardrails(raw: Dict[str, Any], *, images_analyzed: int, images_rejected: int) -> Dict[str, Any]:
    flags: List[str] = []

    category = raw.get("predicted_category")
    if category not in ALLOWED_CATEGORIES:
        flags.append("invalid_category")
        category = "OTHER"

    is_civic = raw.get("is_civic_issue", True) is not False
    matches = raw.get("images_match_description", True) is not False

    department = raw.get("recommended_department")
    allowed_for_category = CATEGORY_ALLOWED_DEPARTMENTS.get(category, ALLOWED_DEPARTMENTS)
    if department not in ALLOWED_DEPARTMENTS or department not in allowed_for_category:
        if department is not None:
            flags.append("department_rerouted")
        department = CATEGORY_DEPARTMENT_ROUTING.get(category, "GENERAL")

    severity = raw.get("severity")
    if severity not in ALLOWED_SEVERITIES:
        flags.append("invalid_severity")
        severity = "MEDIUM"

    lo, hi = SEVERITY_SCORE_RANGE[severity]
    severity_score = int(round(_clamp(raw.get("severity_score"), lo, hi, lo)))

    confidence = _clamp(raw.get("confidence"), 0.0, 1.0, 0.5)
    fraud_score = _clamp(raw.get("fraud_score"), 0.0, 1.0, 0.0)

    # Non-civic content: force safe routing and guarantee human review downstream (<0.7 confidence)
    if not is_civic:
        flags.append("not_civic_issue")
        category, department = "OTHER", "GENERAL"
        severity, severity_score = "LOW", 1
        confidence = min(confidence, 0.4)
        fraud_score = max(fraud_score, 0.7)

    if not matches:
        flags.append("image_text_mismatch")
        confidence = min(confidence, 0.6)
        fraud_score = max(fraud_score, 0.4)

    if images_rejected:
        flags.append("some_images_rejected")
        confidence = min(confidence, 0.75)

    if fraud_score >= 0.7:
        flags.append("possible_fraud")
        confidence = min(confidence, 0.5)

    report = raw.get("ai_report") if isinstance(raw.get("ai_report"), dict) else {}
    urgency = report.get("estimated_repair_urgency")
    if urgency not in ALLOWED_URGENCIES:
        urgency = {"CRITICAL": "EMERGENCY", "HIGH": "EXPEDITE"}.get(severity, "STANDARD")

    readable = category.lower().replace("_", " ")

    return {
        "predicted_category": category,
        "recommended_department": department,
        "severity": severity,
        "severity_score": severity_score,
        "confidence": round(confidence, 3),
        "fraud_score": round(fraud_score, 3),
        "issue_label": _clean_text(raw.get("issue_label"), 80, readable.capitalize()),
        "is_civic_issue": is_civic,
        "images_analyzed": images_analyzed,
        "guardrail_flags": flags,
        "ai_report": {
            "summary": _clean_text(report.get("summary"), MAX_TEXT, f"Reported {readable} requiring assessment by {department}."),
            "key_observations": _clean_list(report.get("key_observations"), ["Visual assessment recorded."]),
            "immediate_hazards": _clean_list(report.get("immediate_hazards"), ["None immediate"]),
            "recommended_action": _clean_text(
                report.get("recommended_action"), MAX_TEXT, f"Dispatch a {department} crew to inspect and remediate."
            ),
            "estimated_repair_urgency": urgency,
        },
    }
