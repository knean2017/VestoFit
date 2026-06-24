"""LLM abstraction — Gemini 2.5 Flash-Lite via REST (vision + text)."""

from __future__ import annotations

import base64
import json
import re
from typing import Any

import httpx

from app.config import get_settings

_settings = get_settings()
_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


class LlmError(RuntimeError):
    pass


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise LlmError(f"Invalid JSON from LLM: {text[:200]}") from e


async def _gemini_generate(parts: list[dict], *, json_mode: bool = True) -> str:
    if not _settings.gemini_api_key:
        raise LlmError("GEMINI_API_KEY is not configured")

    model = _settings.llm_model
    url = f"{_GEMINI_BASE}/models/{model}:generateContent"
    body: dict[str, Any] = {"contents": [{"parts": parts}]}
    if json_mode:
        body["generationConfig"] = {"responseMimeType": "application/json"}

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            url,
            params={"key": _settings.gemini_api_key},
            json=body,
        )
        if r.status_code >= 400:
            raise LlmError(f"Gemini error ({r.status_code}): {r.text[:300]}")
        data = r.json()

    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise LlmError(f"Unexpected Gemini response: {data}") from e


TAGGING_SYSTEM = """You are a fashion cataloguer. Look at the single clothing item in the image and return ONLY valid JSON, no prose.

Return:
{
  "category": "tops | bottoms | dresses",
  "name": "<short human name>",
  "color": "<primary color>",
  "pattern": "solid | striped | plaid | floral | graphic | other",
  "formality": "casual | smart-casual | formal",
  "season": "all | summer | winter | spring-fall",
  "warmth": 1-5
}
If the image is not a single clothing item, return {"category": null}."""


async def tag_garment_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict[str, Any]:
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    parts = [
        {"text": TAGGING_SYSTEM},
        {"inline_data": {"mime_type": mime_type, "data": b64}},
    ]
    raw = await _gemini_generate(parts, json_mode=True)
    return _parse_json(raw)


STYLIST_SYSTEM = """You are a personal stylist. You ONLY discuss clothing and outfits.
If the request is unrelated to clothes/style, set decline=true and items=[].
You may ONLY choose items from the wardrobe JSON list provided. Never invent items.

Valid combos:
- exactly one dress (category dresses), OR
- one top + one bottom, OR
- two tops + one bottom (first top = base, second top = outer layer)

Respond ONLY as JSON:
{
  "items": ["<uuid>", ...],
  "reasoning": "<2-3 warm sentences>",
  "decline": false
}"""


async def stylist_suggest(wardrobe_json: str, prompt: str) -> dict[str, Any]:
    parts = [
        {
            "text": (
                f"{STYLIST_SYSTEM}\n\nWardrobe:\n{wardrobe_json}\n\n"
                f"User request: {prompt}"
            )
        }
    ]
    raw = await _gemini_generate(parts, json_mode=True)
    return _parse_json(raw)


ASK_SYSTEM = """You are a personal stylist assistant. ONLY answer questions about clothing, outfits, and style.
If off-topic, politely decline and steer back to fashion. Be concise and helpful."""


async def stylist_ask(
    wardrobe_json: str,
    prompt: str,
    *,
    item_ids: list[str] | None = None,
    json_mode: bool = False,
) -> str:
    extra = f"\nReferenced item ids: {item_ids}" if item_ids else ""
    parts = [
        {
            "text": (
                f"{ASK_SYSTEM}\n\nWardrobe:\n{wardrobe_json}{extra}\n\n"
                f"User: {prompt}"
            )
        }
    ]
    return await _gemini_generate(parts, json_mode=json_mode)


STYLIST_ASK_STRUCTURED = """You are a personal stylist assistant. ONLY answer questions about clothing, outfits, and style.
If off-topic, politely decline and steer back to fashion. Be concise and helpful.

Respond as JSON:
{
  "reply": "<your conversational response>",
  "chips": ["<suggested quick reply 1>", ...] or null
}

Chips are optional 1-4 word quick-reply suggestions the user can tap. Use them when there are natural follow-up actions.
Examples: after suggesting an outfit → ["Try it on", "Something different", "More casual"]
For a new user with empty wardrobe → ["Add from closet", "Browse shop"]
When no follow-up is natural → null"""


async def stylist_ask_structured(
    wardrobe_json: str,
    prompt: str,
    *,
    item_ids: list[str] | None = None,
) -> dict[str, Any]:
    extra = f"\nReferenced item ids: {item_ids}" if item_ids else ""
    parts = [
        {
            "text": (
                f"{STYLIST_ASK_STRUCTURED}\n\nWardrobe:\n{wardrobe_json}{extra}\n\n"
                f"User: {prompt}"
            )
        }
    ]
    raw = await _gemini_generate(parts, json_mode=True)
    try:
        parsed = _parse_json(raw)
        return {
            "reply": str(parsed.get("reply", raw)),
            "chips": parsed.get("chips"),
        }
    except LlmError:
        return {"reply": raw, "chips": None}


SHOPPING_ASK_SYSTEM = """You are a shopping assistant for a fashion app. Help users find clothes to buy.

Given the user's message (and optional conversation history), decide:
1. If the user has a clear, specific shopping request → extract search parameters
2. If the request is vague → ask ONE follow-up question with quick-reply chips
3. If conversational/advisory → just reply, no search

Respond as JSON:
{
  "reply": "<your conversational response>",
  "search": {"query": "<search terms>", "budget_max": <number or null>, "category": "<tops|bottoms|dresses or null>"} or null,
  "chips": ["<quick reply>", ...] or null
}

Rules:
- "search" is null when you need more info or are just chatting
- "search" is filled when you have enough to search (at minimum a query)
- budget_max is a number in USD or null if not specified
- category must be exactly "tops", "bottoms", or "dresses", or null
- chips are 1-4 word tap-able suggestions, max 4 items
- Be warm and helpful, like a personal shopper"""


async def shopping_ask(
    prompt: str,
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    context = ""
    if history:
        for msg in history[-10:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            context += f"\n{role.capitalize()}: {content}"

    parts = [
        {
            "text": (
                f"{SHOPPING_ASK_SYSTEM}\n\n"
                f"{'Conversation so far:' + context + chr(10) + chr(10) if context else ''}"
                f"User: {prompt}"
            )
        }
    ]
    raw = await _gemini_generate(parts, json_mode=True)
    try:
        parsed = _parse_json(raw)
        return {
            "reply": str(parsed.get("reply", raw)),
            "search": parsed.get("search"),
            "chips": parsed.get("chips"),
        }
    except LlmError:
        return {"reply": raw, "search": None, "chips": None}
