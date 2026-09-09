"""OpenRouter-powered LLM narrative for scored infrastructure projects.

This module is intentionally dependency-light: it only requires ``httpx``
(already a project dependency) and reads configuration from environment
variables or an optional ``.env`` file in the project root.

Configuration (see ``.env.example``):
    OPENROUTER_API_KEY   required to enable the feature
    OPENROUTER_MODEL     optional model id (default below)
    OPENROUTER_BASE_URL  optional API base override

Design notes
------------
* Everything degrades gracefully. If no API key is configured, or a call
  fails, ``generate_narrative`` returns ``available=False`` / an error string
  and the caller falls back to the deterministic template text it already
  builds in ``api.py``.
* The prompt is grounded strictly in the numbers we pass in the context, so
  the model is discouraged from inventing facts about a project.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

# Default model used for OpenRouter narratives.
DEFAULT_MODEL = "qwen/qwen3-reranker-8b"
DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
_TIMEOUT = httpx.Timeout(60.0, connect=10.0)

# Fields worth handing to the LLM, in a stable, readable order.
_CONTEXT_FIELDS = (
    "project_id", "name", "sector", "state", "ministry",
    "risk_level", "final_risk_score", "health",
    "cop_prob", "top_prob",
    "cost_overrun_to_date_pct", "schedule_slip_months",
    "physical_progress_pct", "financial_progress_pct",
    "sector_risk_baseline", "state_risk_baseline",
)


def _load_dotenv(path: Optional[Path] = None) -> None:
    """Minimal .env loader (KEY=VALUE lines) so the key can live in a file."""
    target = path or Path(__file__).resolve().parent / ".env"
    if not target.is_file():
        return
    for raw in target.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv()


def get_config() -> Dict[str, str]:
    """Return the resolved OpenRouter configuration."""
    return {
        "api_key": os.getenv("OPENROUTER_API_KEY", "").strip(),
        "model": os.getenv("OPENROUTER_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL,
        "base_url": os.getenv("OPENROUTER_BASE_URL", DEFAULT_BASE_URL).strip() or DEFAULT_BASE_URL,
    }


def is_available() -> bool:
    """True when an API key is configured (the feature is enabled)."""
    return bool(get_config()["api_key"])


def build_context(result: Dict[str, Any]) -> Dict[str, Any]:
    """Extract the compact, LLM-relevant subset of a scored project result."""
    ctx: Dict[str, Any] = {}
    for field in _CONTEXT_FIELDS:
        if field in result and result[field] is not None:
            ctx[field] = result[field]
    # SHAP drivers -> readable "feature: +value" lines.
    drivers = result.get("shap_drivers") or []
    ctx["top_shap_drivers"] = [
        {
            "feature": d.get("feature", ""),
            "shap_value": round(float(d.get("shap_value", 0)), 3),
        }
        for d in drivers[:5]
    ]
    # Active warning flags -> readable names.
    warnings = result.get("warnings") or []
    ctx["active_warnings"] = [
        {
            "warning_type": w.get("warning_type", ""),
            "severity": w.get("severity", ""),
            "signal_value": w.get("signal_value"),
        }
        for w in warnings
    ]
    return ctx


_SYSTEM_PROMPT = (
    "You are an expert infrastructure oversight analyst for Indian "
    "megaprojects. You are given structured risk-model output for ONE project. "
    "Write a concise executive brief (3-5 sentences, no markdown, no bullet "
    "lists) that: (1) states the project, its overall risk level and composite "
    "score out of 100; (2) names the top 2-3 risk drivers and how they are "
    "pushing the score; (3) highlights any active warning flags; (4) closes "
    "with the single most important action the project team should take. "
    "Ground every statement strictly in the numbers provided - do NOT invent "
    "costs, dates, or facts that are not present. Write in plain, professional "
    "English."
)


def generate_narrative(
    context: Dict[str, Any],
    *,
    model: Optional[str] = None,
    timeout: Optional[httpx.Timeout] = None,
) -> Dict[str, Any]:
    """Call OpenRouter to generate a natural-language brief for a project.

    Returns a dict with keys:
        narrative   str | None   the generated text, or None on failure
        model       str          the model id used (or configured)
        available   bool         whether an API key was configured
        error       str | None   human-readable failure reason (if any)
    """
    cfg = get_config()
    model = model or cfg["model"]

    if not cfg["api_key"]:
        return {"narrative": None, "model": model, "available": False,
                "error": "OPENROUTER_API_KEY is not configured"}

    url = f"{cfg['base_url'].rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg['api_key']}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(context, ensure_ascii=False, indent=2)},
        ],
        "temperature": 0.4,
        "max_tokens": 400,
    }

    try:
        with httpx.Client(timeout=timeout or _TIMEOUT) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
        narrative = (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
        if not narrative:
            return {"narrative": None, "model": model, "available": True,
                    "error": "OpenRouter returned an empty response"}
        return {"narrative": narrative, "model": model, "available": True, "error": None}
    except httpx.HTTPStatusError as exc:
        detail = ""
        try:
            detail = exc.response.text[:300]
        except Exception:
            pass
        return {"narrative": None, "model": model, "available": True,
                "error": f"OpenRouter HTTP {exc.response.status_code}: {detail}"}
    except Exception as exc:  # network, timeout, JSON, etc.
        return {"narrative": None, "model": model, "available": True,
                "error": f"OpenRouter request failed: {exc}"}
