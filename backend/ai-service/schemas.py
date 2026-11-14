"""
Pydantic schemas: the HTTP contract with the Node backend, and the structured output the agent must produce.
"""
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

Category = Literal[
    "GARBAGE",
    "POTHOLE",
    "BROKEN_INFRASTRUCTURE",
    "ANIMAL_CARCASS",
    "GRAFFITI",
    "DAMAGED_SIGNBOARD",
    "WATER_LEAKAGE",
    "OTHER",
]
Department = Literal[
    "SANITATION",
    "ROADS",
    "ELECTRICITY",
    "WATER_SUPPLY",
    "PUBLIC_WORKS",
    "TRAFFIC_INFRASTRUCTURE",
    "GENERAL",
]
Severity = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
Urgency = Literal["STANDARD", "EXPEDITE", "EMERGENCY"]


# ---------- Agent structured output (what Gemini must return) ----------
# Kept to simple types + enums so it converts cleanly to Gemini's response schema.
# Numeric bounds are enforced afterwards in guardrails.py, not trusted from the model.

class CivicAssessmentReport(BaseModel):
    summary: str = Field(description="1-2 sentence factual summary of the issue for municipal staff.")
    key_observations: List[str] = Field(description="2-5 concrete visual observations from the photos.")
    immediate_hazards: List[str] = Field(
        description="Risks to people, vehicles or property. Use ['None immediate'] if there are none."
    )
    recommended_action: str = Field(description="Specific remediation action for the assigned department.")
    estimated_repair_urgency: Urgency = Field(description="STANDARD, EXPEDITE or EMERGENCY.")


class CivicAssessment(BaseModel):
    is_civic_issue: bool = Field(
        description="False if the photos do not show a public civic/infrastructure problem "
        "(e.g. selfies, screenshots, indoor/private property, memes, blank images)."
    )
    images_match_description: bool = Field(
        description="True if the photos are consistent with the citizen's title and description."
    )
    issue_label: str = Field(description="Short human-readable name of the issue, e.g. 'Overflowing garbage bin'.")
    predicted_category: Category
    recommended_department: Department
    severity: Severity
    severity_score: int = Field(description="Integer 1-5 consistent with severity (LOW=1-2, MEDIUM=2-3, HIGH=4, CRITICAL=5).")
    confidence: float = Field(description="Confidence in the category, 0.0-1.0.")
    fraud_score: float = Field(
        description="Likelihood 0.0-1.0 that the submission is fake, a stock/internet photo, staged or unrelated."
    )
    ai_report: CivicAssessmentReport


# ---------- HTTP contract with the Node backend (unchanged field names) ----------

class ClassificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    report_id: Optional[str] = Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=5, max_length=3000)
    image_urls: List[HttpUrl] = Field(..., min_length=1, max_length=5)
    coordinates: Optional[List[float]] = Field(default=None, min_length=2, max_length=2)


class AIReportDetail(BaseModel):
    summary: str
    key_observations: List[str]
    immediate_hazards: List[str]
    recommended_action: str
    estimated_repair_urgency: str


class ClassificationResponse(BaseModel):
    success: bool
    report_id: Optional[str]
    predicted_category: str
    recommended_department: str
    severity: str
    severity_score: int
    confidence: float
    fraud_score: float
    ai_report: AIReportDetail
    model_version: str
    processed_at: str
    # Additive fields (ignored by older backends)
    issue_label: str = ""
    is_civic_issue: bool = True
    images_analyzed: int = 0
    guardrail_flags: List[str] = []
