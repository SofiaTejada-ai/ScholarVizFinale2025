# cyber_routes.py

from __future__ import annotations
from typing import List, Dict, Any
import re

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
        "per_page": 30,
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
        loc = (w.get("primary_location") or {})
        src = (loc.get("source") or {})
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
        cited_by = w.get("cited_by_count") or 0
        out.append(
            {
                "title": title,
                "year": year,
                "venue": venue,
                "url": url,
                "authors": authors,
                "cited_by_count": cited_by,
            }
        )

    out = [c for c in out if c.get("year")]
    out.sort(key=lambda c: (c["year"], c.get("cited_by_count", 0)), reverse=True)
    return out[:max_results]


def extract_mermaid(raw: str) -> str:
    if not raw:
        return ""
    text = raw.strip()
    m = re.search(r"```mermaid(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if m:
        text = m.group(1)
    else:
        m2 = re.search(r"```(.*)```", text, re.DOTALL)
        if m2:
            text = m2.group(1)
    text = text.strip()
    if not text:
        return ""
    if text.lower().startswith("mermaid"):
        text = text[len("mermaid") :].strip()
    return text


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

    explanation_prompt = (
        "Explain the following cybersecurity concept for an undergraduate CS student. "
        "Write in clear, professional, plain English paragraphs. "
        "Do not use markdown, bullet points, asterisks, or headings. "
        "Focus on what it is, why it matters in real systems, at least one concrete attack example, "
        "and at least one defense strategy. "
        "Keep it around 250–350 words.\n\n"
        f"Concept: {topic}\n"
        f"{refs_text}\n"
        "You may mention relevant papers by index in brackets like [1], [2] if genuinely useful."
    )

    gpt_answer = ask_gpt(explanation_prompt)
    gemini_answer = ask_gemini(explanation_prompt)

    explanation = gpt_answer
    if not explanation or explanation.startswith("(GPT error"):
        explanation = gemini_answer

    diagram_prompt = (
        "Draw a concise Mermaid flowchart that illustrates the core data and control flow for the following "
        "cybersecurity concept. Focus on 8–14 nodes, avoid long labels, and keep it readable. "
        "Output only raw Mermaid code, no backticks, no surrounding markdown, no explanation.\n\n"
        f"Concept: {topic}"
    )
    diagram_raw = ask_gpt(diagram_prompt)
    diagram_mermaid = extract_mermaid(diagram_raw)

    return JSONResponse(
        {
            "ok": True,
            "topic": topic,
            "explanation": explanation,
            "diagram_mermaid": diagram_mermaid,
            "citations": citations,
        }
    )
