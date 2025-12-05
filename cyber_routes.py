from __future__ import annotations

import base64
from typing import List, Dict, Any

import httpx
import fitz
from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from llm_client import ask_gpt, ask_gemini

router = APIRouter(tags=["concepts"])

OPENALEX_BASE = "https://api.openalex.org/works"

_STOPWORDS = {
    "draw",
    "design",
    "show",
    "explain",
    "describe",
    "using",
    "use",
}


async def fetch_openalex_works(topic: str, per_page: int = 40) -> List[Dict[str, Any]]:
    params = {
        "search": topic,
        "filter": "language:en",
        "sort": "publication_date:desc",
        "per_page": per_page,
    }
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(OPENALEX_BASE, params=params)
            r.raise_for_status()
            data = r.json()
            return data.get("results", []) or []
    except Exception:
        return []


def _abstract_text(work: Dict[str, Any]) -> str:
    inv = work.get("abstract_inverted_index") or {}
    if not isinstance(inv, dict):
        return ""
    words = list(inv.keys())
    return " ".join(words)


def _score_work_for_topic(work: Dict[str, Any], topic: str) -> int:
    t = (topic or "").lower()
    text = ((work.get("title") or "") + " " + _abstract_text(work)).lower()
    score = 0
    topic_tokens = [w for w in t.replace(",", " ").split() if len(w) > 3]
    for tok in topic_tokens:
        if tok in text:
            score += 3
    strong_security = [
        "cybersecurity",
        "intrusion",
        "threat detection",
        "anomaly detection",
        "security event",
        "log analysis",
        "log analytics",
        "log correlation",
        "event correlation",
        "monitoring",
        "incident response",
    ]
    for kw in strong_security:
        if kw in text:
            score += 2
    if "siem" in t or "security information and event management" in t:
        if "siem" in text or "security information and event management" in text:
            score += 8
        if "log" in text and "correlation" in text:
            score += 4
        if "alert" in text or "incident response" in text:
            score += 3
    if "zero trust" in t or "zta" in t:
        if "zero trust" in text or "zta" in text:
            score += 8
        if "microsegmentation" in text or "micro-segmentation" in text:
            score += 3
    return score


def _topic_token_hits(work: Dict[str, Any], topic: str) -> int:
    t = (topic or "").lower()
    if not t:
        return 0
    text = ((work.get("title") or "") + " " + _abstract_text(work)).lower()
    tokens = [
        w
        for w in t.replace(",", " ").split()
        if len(w) > 3 and w not in _STOPWORDS
    ]
    if not tokens:
        return 0
    return sum(1 for tok in tokens if tok in text)


def build_citations(works: List[Dict[str, Any]], topic: str, max_results: int = 5) -> List[Dict[str, Any]]:
    scored = []
    for w in works:
        year = w.get("publication_year")
        if not year:
            continue
        score = _score_work_for_topic(w, topic)
        cited = w.get("cited_by_count") or 0
        scored.append((score, year, cited, w))
    scored.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)
    out: List[Dict[str, Any]] = []
    for score, year, cited, w in scored[:max_results]:
        loc = w.get("primary_location") or {}
        src = loc.get("source") or {}
        venue = src.get("display_name")
        url = (
            loc.get("landing_page_url")
            or loc.get("pdf_url")
            or (w.get("open_access") or {}).get("oa_url")
            or w.get("id")
        )
        authors = ", ".join(
            a.get("author", {}).get("display_name", "")
            for a in (w.get("authorships") or [])[:4]
        )
        out.append(
            {
                "title": w.get("title") or "(untitled)",
                "year": year,
                "venue": venue,
                "url": url,
                "authors": authors,
                "cited_by_count": cited,
                "relevance_score": score,
            }
        )
    return out


def _looks_logo_like(pix: fitz.Pixmap) -> bool:
    w, h, n = pix.width, pix.height, pix.n
    if w <= 0 or h <= 0 or n < 1:
        return True
    data = pix.samples
    step_x = max(1, w // 32)
    step_y = max(1, h // 32)
    colors = set()
    max_colors = 24
    for y in range(0, h, step_y):
        row_offset = y * w * n
        for x in range(0, w, step_x):
            idx = row_offset + x * n
            rgb = data[idx : idx + 3]
            colors.add(bytes(rgb))
            if len(colors) > max_colors:
                return False
    return True


async def try_extract_figure_from_relevant_pdf(
    works: List[Dict[str, Any]],
    topic: str,
    min_score: int = 4,
) -> tuple[str | None, str | None]:
    topic_lower = (topic or "").lower()
    tokens = [
        w
        for w in topic_lower.replace(",", " ").split()
        if len(w) > 3 and w not in _STOPWORDS
    ]
    if len(tokens) <= 1:
        required_hits = 1
    else:
        required_hits = 2
    candidates: list[tuple[int, int, Dict[str, Any]]] = []
    for w in works:
        hits = _topic_token_hits(w, topic)
        if hits < required_hits:
            continue
        s = _score_work_for_topic(w, topic)
        if s < min_score:
            continue
        candidates.append((s, hits, w))
    if not candidates:
        return None, None
    candidates.sort(key=lambda x: (x[0], x[1]), reverse=True)
    for score, hits, w in candidates[:6]:
        loc = w.get("primary_location") or {}
        oa = w.get("open_access") or {}
        pdf_url = loc.get("pdf_url") or oa.get("oa_url")
        if not pdf_url:
            continue
        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                r = await client.get(pdf_url)
                r.raise_for_status()
                pdf_bytes = r.content
        except Exception:
            continue
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception:
            continue
        try:
            for page_index in range(len(doc)):
                if page_index == 0:
                    continue
                page = doc[page_index]
                images = page.get_images(full=True)
                if not images:
                    continue
                for img in images:
                    xref = img[0]
                    try:
                        pix = fitz.Pixmap(doc, xref)
                        if pix.width < 200 or pix.height < 150:
                            continue
                        if _looks_logo_like(pix):
                            continue
                        if pix.n >= 5:
                            pix = fitz.Pixmap(fitz.csRGB, pix)
                        png_bytes = pix.tobytes("png")
                        b64 = base64.b64encode(png_bytes).decode("ascii")
                        data_url = "data:image/png;base64," + b64
                        title = w.get("title") or "(untitled)"
                        year = w.get("publication_year")
                        venue = ((loc.get("source") or {}).get("display_name")) or ""
                        parts = [title]
                        if venue:
                            parts.append(venue)
                        if year:
                            parts.append(str(year))
                        caption = "Figure extracted from: " + ", ".join(parts) + "."
                        doc.close()
                        return data_url, caption
                    except Exception:
                        continue
        finally:
            try:
                doc.close()
            except Exception:
                pass
    return None, None


@router.post("/concept")
async def concept(payload: dict = Body(...)):
    topic = (payload or {}).get("topic") or ""
    topic = topic.strip()
    if not topic:
        return JSONResponse(
            {"ok": False, "error": "Missing 'topic' in body"},
            status_code=400,
        )
    works = await fetch_openalex_works(topic, per_page=60)
    citations = build_citations(works, topic, max_results=5)
    refs_text = ""
    if citations:
        lines = []
        for i, c in enumerate(citations, start=1):
            line = f"[{i}] {c['title']} ({c['year']}) — {c.get('venue') or ''}"
            lines.append(line)
        refs_text = "\n\nKey recent papers:\n" + "\n".join(lines)
    summary_prompt = (
        f"Explain the cybersecurity concept '{topic}' in about 220–260 words "
        "for an undergraduate CS student. Cover what it is, why it matters in real systems, "
        "and at least one concrete attack and defender strategy.\n"
        "Use clear paragraphs, no bullet lists, no markdown symbols like **.\n"
        "You may allude to the following recent papers but do not fabricate citations:"
        f"{refs_text}"
    )
    summary = ask_gpt(summary_prompt)
    mermaid_prompt = (
        "You are designing a simple, clean architecture diagram using Mermaid.\n"
        f"Draw a single flowchart TD that illustrates the concept: {topic}.\n"
        "Focus on 6–12 nodes and key flows only. Do not explain the diagram.\n"
        "Output ONLY valid Mermaid code starting with 'flowchart TD'. No backticks, no text.\n"
    )
    diagram_mermaid = ask_gpt(mermaid_prompt)
    figure_image_url, figure_caption = await try_extract_figure_from_relevant_pdf(works, topic)
    return JSONResponse(
        {
            "ok": True,
            "topic": topic,
            "summary": summary,
            "diagram_mermaid": diagram_mermaid,
            "citations": [
                {
                    "title": c["title"],
                    "year": c["year"],
                    "venue": c["venue"],
                    "url": c["url"],
                    "authors": c["authors"],
                }
                for c in citations
            ],
            "figure_image_url": figure_image_url,
            "figure_caption": figure_caption,
        }
    )
