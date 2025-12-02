from __future__ import annotations

from typing import List, Dict, Any

import httpx
from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from llm_client import ask_gpt, ask_gemini

router = APIRouter(tags=["cyber"])

OPENALEX_BASE = "https://api.openalex.org/works"


async def fetch_citations(topic: str, max_results: int = 5) -> List[Dict[str, Any]]:
    params = {
        "search": topic,
        "filter": "language:en",
        "sort": "publication_date:desc",
        "per_page": 20,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(OPENALEX_BASE, params=params)
            r.raise_for_status()
            data = r.json().get("results", [])
    except Exception:
        return []

    out: List[Dict[str, Any]] = []
    for w in data:
        title = w.get("title") or "(untitled)"
        year = w.get("publication_year")
        loc = w.get("primary_location") or {}
        src = loc.get("source") or {}
        venue = src.get("display_name")
        url = (
            loc.get("landing_page_url")
            or (w.get("open_access") or {}).get("oa_url")
            or w.get("id")
        )
        authors = ", ".join(
            a.get("author", {}).get("display_name", "")
            for a in (w.get("authorships") or [])[:4]
        )
        out.append(
            {
                "title": title,
                "year": year,
                "venue": venue,
                "url": url,
                "authors": authors,
            }
        )

    out = [c for c in out if c.get("year")]
    out.sort(key=lambda c: c["year"], reverse=True)
    return out[:max_results]


@router.post("/concept")
async def concept(payload: dict = Body(...)):
    topic = (payload or {}).get("topic") or ""
    topic = topic.strip()
    if not topic:
        return JSONResponse(
            {"ok": False, "error": "Missing 'topic' in body"}, status_code=400
        )

    citations = await fetch_citations(topic, max_results=5)

    refs_text = ""
    if citations:
        lines = []
        for i, c in enumerate(citations, start=1):
            line = f"[{i}] {c['title']} ({c['year']}) — {c.get('venue') or ''}"
            lines.append(line)
        refs_text = "\n\nKey recent papers:\n" + "\n".join(lines)

    gpt_system_prompt = (
        "You are a cybersecurity tutor for an undergraduate CS student. "
        "Explain clearly with solid technical depth but avoid unnecessary jargon. "
        "Use the references [1]–[5] I give you where helpful, but do not invent fake citations."
    )
    gpt_user_prompt = (
        f"Topic:\n{topic}\n\n"
        "Task: Explain this concept in about 350–500 words for a CS undergrad.\n"
        "Focus on:\n"
        "1) What the concept is.\n"
        "2) Why it matters for real systems.\n"
        "3) Concrete examples of attacks and defenses.\n"
        "If you reference a paper, mention it like [1], [2], etc.\n"
        + refs_text
    )

    gemini_prompt = (
        "You are a helpful cybersecurity explainer. "
        "Explain concepts step by step with analogies and concrete scenarios. "
        "Assume the reader has taken basic security and systems courses.\n\n"
        f"Explain the following concept for a CS undergraduate:\n{topic}\n\n"
        "Keep it around 300–400 words. "
        "Highlight risks, real-world impact, and at least two defender strategies."
    )

    try:
        gpt_answer = ask_gpt(gpt_system_prompt, gpt_user_prompt)
    except Exception as e:
        gpt_answer = f"(GPT error: {e})"

    try:
        gemini_answer = ask_gemini(gemini_prompt)
    except Exception as e:
        gemini_answer = f"(Gemini error: {e})"

    combined_prompt = (
        "You are a cybersecurity tutor for an undergraduate CS student.\n\n"
        f"The student asked about:\n{topic}\n\n"
        "Here is Answer A (from ChatGPT):\n"
        f"{gpt_answer}\n\n"
        "Here is Answer B (from Gemini):\n"
        f"{gemini_answer}\n\n"
        "Write a single clear 400–500 word explanation that merges the best ideas from both answers. "
        "Remove repetition. Use this structure:\n"
        "1) What the concept is\n"
        "2) Why it matters for real systems\n"
        "3) Concrete examples of attacks and defenses\n"
        "4) Brief summary of recent academic defenses\n"
        "If Answer A uses citations like [1]–[5], keep those markers in sensible places. "
        "Do not invent new citations."
    )

    combined_answer = ask_gpt(combined_prompt)

    summary = combined_answer
    if len(summary) > 700:
        summary = summary[:700] + "..."

    return JSONResponse(
        {
            "ok": True,
            "topic": topic,
            "summary": summary,
            "gpt_answer": gpt_answer,
            "gemini_answer": gemini_answer,
            "combined_answer": combined_answer,
            "citations": citations,
        }
    )
