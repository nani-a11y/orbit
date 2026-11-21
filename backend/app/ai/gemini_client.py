"""Google Gen AI Python SDK integration for standalone FastAPI deployments."""

from __future__ import annotations

import json
import os
from typing import Any, Dict

try:
    from google import genai
    from google.genai import types
except ImportError:  # pragma: no cover - optional when running stdlib bridge
    genai = None  # type: ignore
    types = None  # type: ignore


DEFAULT_MODEL = "gemini-4-hydrogen"


def interpret_scenario_python(prompt: str, context: Dict[str, Any] | None = None) -> Dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured in the server environment.")
    if genai is None:
        raise RuntimeError("google-genai package is not installed in this Python environment.")

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=DEFAULT_MODEL,
        contents=json.dumps({"prompt": prompt, "context": context or {}}),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            system_instruction=(
                "You are ORBIT's mathematical modeling assistant. Convert natural-language "
                "system descriptions into canonical ORBIT stock-and-flow JSON specifications "
                "using only safe scalar equations. Never output executable Python scripts."
            ),
        ),
    )
    return json.loads(response.text or "{}")
