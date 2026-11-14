"""
CivicFlow AI service configuration. All secrets come from the environment - never hardcode keys here.
"""
import os
from dotenv import load_dotenv

load_dotenv()


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


PORT = _int("AI_SERVICE_PORT", 8000)
HOST = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
ENVIRONMENT = os.getenv("AI_SERVICE_ENV", "development")

# ----- Groq (free tier, vision-language model) -----
# Free key, no credit card: https://console.groq.com/keys (starts with "gsk_")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
# Must be a Groq model that accepts images (gpt-oss-* models are text-only and fail with "content must be a string")
GROQ_MODEL_ID = os.getenv("GROQ_MODEL_ID", "qwen/qwen3.8-27b")
GROQ_TEMPERATURE = _float("GROQ_TEMPERATURE", 0.2)
GROQ_MAX_TOKENS = _int("GROQ_MAX_TOKENS", 2048)
GROQ_TIMEOUT_SECONDS = _float("GROQ_TIMEOUT_SECONDS", 45.0)
# Free tier is rate-limited: retry 429s / transient errors with backoff before giving up
GROQ_RETRIES = _int("GROQ_RETRIES", 2)
GROQ_RETRY_DELAY_SECONDS = _float("GROQ_RETRY_DELAY_SECONDS", 3.0)

# ----- Service-to-service auth -----
# Shared secret the Node backend must send as X-Internal-Api-Key. Required in production.
AI_SERVICE_API_KEY = os.getenv("AI_SERVICE_API_KEY", "")

# ----- Image ingestion guardrails (SSRF / resource limits) -----
IMAGE_ALLOWED_HOSTS = [
    h.strip().lower()
    for h in os.getenv("IMAGE_ALLOWED_HOSTS", "res.cloudinary.com").split(",")
    if h.strip()
]
MAX_IMAGE_BYTES = _int("MAX_IMAGE_BYTES", 8 * 1024 * 1024)
IMAGE_FETCH_TIMEOUT_SECONDS = _float("IMAGE_FETCH_TIMEOUT_SECONDS", 10.0)
# Bounded so requests stay well under Groq's base64 image size limit and token use stays predictable
MAX_IMAGE_DIMENSION = _int("MAX_IMAGE_DIMENSION", 1568)
# Kept low for the free tier's requests-per-minute / tokens-per-minute limits
MAX_CONCURRENT_ANALYSES = _int("MAX_CONCURRENT_ANALYSES", 2)

# ----- Domain vocabulary (must match backend/src/constants) -----
ALLOWED_CATEGORIES = [
    "GARBAGE",
    "POTHOLE",
    "BROKEN_INFRASTRUCTURE",
    "ANIMAL_CARCASS",
    "GRAFFITI",
    "DAMAGED_SIGNBOARD",
    "WATER_LEAKAGE",
    "OTHER",
]

ALLOWED_DEPARTMENTS = [
    "SANITATION",
    "ROADS",
    "ELECTRICITY",
    "WATER_SUPPLY",
    "PUBLIC_WORKS",
    "TRAFFIC_INFRASTRUCTURE",
    "GENERAL",
]

ALLOWED_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

ALLOWED_URGENCIES = ["STANDARD", "EXPEDITE", "EMERGENCY"]

# Primary routing (mirrors backend CATEGORY_DEPARTMENT_MAP)
CATEGORY_DEPARTMENT_ROUTING = {
    "GARBAGE": "SANITATION",
    "POTHOLE": "ROADS",
    "BROKEN_INFRASTRUCTURE": "PUBLIC_WORKS",
    "ANIMAL_CARCASS": "SANITATION",
    "GRAFFITI": "PUBLIC_WORKS",
    "DAMAGED_SIGNBOARD": "TRAFFIC_INFRASTRUCTURE",
    "WATER_LEAKAGE": "WATER_SUPPLY",
    "OTHER": "GENERAL",
}

# Departments the agent may choose for each category. Anything else is overridden
# with the primary route, so a confused or manipulated model can't misroute a report.
CATEGORY_ALLOWED_DEPARTMENTS = {
    "GARBAGE": ["SANITATION"],
    "POTHOLE": ["ROADS"],
    "BROKEN_INFRASTRUCTURE": ["PUBLIC_WORKS", "ELECTRICITY", "ROADS"],
    "ANIMAL_CARCASS": ["SANITATION"],
    "GRAFFITI": ["PUBLIC_WORKS"],
    "DAMAGED_SIGNBOARD": ["TRAFFIC_INFRASTRUCTURE", "ROADS"],
    "WATER_LEAKAGE": ["WATER_SUPPLY", "SANITATION"],
    "OTHER": ALLOWED_DEPARTMENTS,
}

# Severity -> permitted severity_score range (inclusive)
SEVERITY_SCORE_RANGE = {
    "LOW": (1, 2),
    "MEDIUM": (2, 3),
    "HIGH": (4, 4),
    "CRITICAL": (5, 5),
}
