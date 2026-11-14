"""
CivicFlow Civic Inspector - an Agno agent backed by a vision model on Groq (free tier).

Given citizen photos + text it identifies the civic issue, routes it to a department,
rates severity/authenticity and writes a field report, returned as a validated structure.
"""
import asyncio
import json
import logging
import re
from typing import Any, Dict, List

from agno.agent import Agent
from agno.media import Image
from agno.models.groq import Groq
from agno.run.base import RunStatus

from config import (
    GROQ_API_KEY,
    GROQ_MAX_TOKENS,
    GROQ_MODEL_ID,
    GROQ_RETRIES,
    GROQ_RETRY_DELAY_SECONDS,
    GROQ_TEMPERATURE,
    GROQ_TIMEOUT_SECONDS,
    MAX_CONCURRENT_ANALYSES,
)
from guardrails import apply_guardrails
from image_fetcher import FetchedImage
from prompts import AGENT_DESCRIPTION, AGENT_INSTRUCTIONS, build_report_prompt
from schemas import CivicAssessment

logger = logging.getLogger("civicflow-ai.agent")

_JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)


class AgentNotConfigured(Exception):
    """GROQ_API_KEY is not configured."""


class AgentFailed(Exception):
    """The model call failed or returned an unusable answer."""


def build_groq_model(api_key: str = GROQ_API_KEY, model_id: str = GROQ_MODEL_ID) -> Groq:
    return Groq(
        id=model_id,
        api_key=api_key,
        temperature=GROQ_TEMPERATURE,
        max_tokens=GROQ_MAX_TOKENS,
        timeout=GROQ_TIMEOUT_SECONDS,
    )


def build_civic_agent(api_key: str = GROQ_API_KEY, model_id: str = GROQ_MODEL_ID) -> Agent:
    # Groq has no native structured outputs: Agno requests JSON mode and puts the
    # CivicAssessment schema in the system prompt. The reply is then validated here and
    # passed through guardrails.py, so a malformed or out-of-vocabulary answer can't leak out.
    return Agent(
        name="CivicFlow Civic Inspector",
        model=build_groq_model(api_key, model_id),
        description=AGENT_DESCRIPTION,
        instructions=AGENT_INSTRUCTIONS,
        output_schema=CivicAssessment,
        retries=GROQ_RETRIES,
        delay_between_retries=GROQ_RETRY_DELAY_SECONDS,
        exponential_backoff=True,
        markdown=False,
        # Stateless: every report is assessed independently, nothing is stored or reused
        db=None,
        add_history_to_context=False,
        telemetry=False,
    )


class CivicIssueAnalyzer:
    def __init__(self, agent: Agent | None = None):
        self._agent = agent
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT_ANALYSES)

    @property
    def model_version(self) -> str:
        return f"agno-groq-{GROQ_MODEL_ID}"

    @property
    def is_configured(self) -> bool:
        return self._agent is not None or bool(GROQ_API_KEY)

    def _get_agent(self) -> Agent:
        if self._agent is None:
            if not GROQ_API_KEY:
                raise AgentNotConfigured("GROQ_API_KEY is not set")
            self._agent = build_civic_agent()
        return self._agent

    @staticmethod
    def _to_dict(content: Any) -> Dict[str, Any]:
        if isinstance(content, CivicAssessment):
            return content.model_dump()
        if isinstance(content, dict):
            return CivicAssessment.model_validate(content).model_dump()
        if isinstance(content, str):
            # JSON mode normally returns a bare object; tolerate code fences or stray prose
            match = _JSON_OBJECT.search(content)
            if not match:
                raise ValueError("no JSON object in model output")
            return CivicAssessment.model_validate(json.loads(match.group(0))).model_dump()
        raise ValueError(f"unexpected agent output type {type(content).__name__}")

    async def analyze(
        self,
        *,
        title: str,
        description: str,
        images: List[FetchedImage],
        images_rejected: int = 0,
    ) -> Dict[str, Any]:
        agent = self._get_agent()
        prompt = build_report_prompt(title, description, len(images))
        media = [Image(content=img.content, mime_type=img.mime_type) for img in images]

        async with self._semaphore:
            try:
                run = await agent.arun(input=prompt, images=media)
            except Exception as exc:  # network errors, rate limits, invalid key, timeouts...
                raise AgentFailed(f"model call failed ({exc.__class__.__name__})") from exc

        if getattr(run, "status", None) == RunStatus.error:
            raise AgentFailed(f"model run ended with an error status: {str(run.content)[:200]}")

        try:
            raw = self._to_dict(run.content)
        except Exception as exc:
            raise AgentFailed(f"model returned an invalid assessment ({exc.__class__.__name__})") from exc

        return apply_guardrails(raw, images_analyzed=len(images), images_rejected=images_rejected)
