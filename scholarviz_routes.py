# scholarviz_routes.py — core ScholarViz API

from typing import List, Optional

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from llm_client import ask_gemini, ask_gpt

router = APIRouter(tags=["scholarviz"])


# ---------- Pydantic models ----------

class AskPayload(BaseModel):
    question: str


class ConceptPayload(BaseModel):
    concept: str


class WorkCitation(BaseModel):
    title: str
    year: Optional[int]
    venue: Optional[str]
    authors: str
    url: Optional[str]
    cited_by_count: Optional[int]
    citation: str  # nicely formatted string


class ConceptResponse(BaseModel):
    ok: bool
    concept: str
    gemini_summary: str
    gpt_summary: str
    sources: List[WorkCitation]


# ---------- OpenAlex helpers (Google-Scholar-like citations) ----------

OPENALEX_BASE = "https://api.openalex.org/works"


async def _fetch_openalex_works(query: str, per_page: int = 40) -> list:
    """
    Fetch a bunch of works from OpenAlex for the concept.
    We will later sort & pick the best 5.
    """
    params = {
        "search": query,
        "filter": "language:en,primary_location.source.type:journal",
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


def _format_authors(authorships: list, max_authors: int = 3) -> str:
    names = []
    for a in authorships[:max_authors]:
        nm = (a.get("author") or {}).get("display_name")
        if nm:
            names.append(nm)
    if not names:
        return "Unknown"
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} & {names[1]}"
    return f"{names[0]} et al."


def _build_citation_string(work: dict) -> str:
    title = work.get("title") or "(untitled)"
    year = work.get("publication_year") or ""
    venue = ((work.get("primary_location") or {}).get("source") or {}).get("display_name", "")
    authors = _format_authors(work.get("authorships") or [])
    year_str = str(year) if year else "n.d."
    if venue:
        return f"{authors} ({year_str}). {title}. {venue}."
    return f"{authors} ({year_str}). {title}."


def _map_work_to_citation(work: dict) -> WorkCitation:
    primary_loc = work.get("primary_location") or {}
    oa = work.get("open_access") or {}

    url = (
        primary_loc.get("landing_page_url")
        or primary_loc.get("pdf_url")
        or oa.get("oa_url")
        or work.get("id")
    )

    return WorkCitation(
        title=work.get("title") or "(untitled)",
        year=work.get("publication_year"),
        venue=(primary_loc.get("source") or {}).get("display_name"),
        authors=_format_authors(work.get("authorships") or []),
        url=url,
        cited_by_count=work.get("cited_by_count"),
        citation=_build_citation_string(work),
    )


async def get_top_citations(concept: str, k: int = 5) -> List[WorkCitation]:
    """
    Get many results from OpenAlex, then pick the top k by:
    1) most recent year
    2) highest citation count
    """
    raw = await _fetch_openalex_works(concept, per_page=60)
    if not raw:
        return []

    def sort_key(w: dict):
        year = w.get("publication_year") or 0
        cited = w.get("cited_by_count") or 0
        return (year, cited)

    sorted_works = sorted(raw, key=sort_key, reverse=True)
    top = sorted_works[:k]
    return [ _map_work_to_citation(w) for w in top ]


# ---------- Routes ----------

@router.post("/ask")
def ask(payload: AskPayload):
    """
    Simple: send a question, get both GeminI + ChatGPT answers.
    (No citations here; just a raw comparison.)
    """
    q = payload.question.strip()
    gemini_answer = ask_gemini(q)
    gpt_answer = ask_gpt(q)
    return {
        "ok": True,
        "question": q,
        "gemini_answer": gemini_answer,
        "gpt_answer": gpt_answer,
    }


@router.post("/concept", response_model=ConceptResponse)
async def concept(payload: ConceptPayload):
    """
    Main ScholarViz concept endpoint.

    Input: concept string (e.g., "Zero Trust Architecture")
    Output:
      - Gemini summary
      - ChatGPT summary
      - Top 5 scholarly citations (year + citation count + formatted citation string)
    """
    concept = payload.concept.strip()

    # 1) Fetch citations
    sources = await get_top_citations(concept, k=5)

    # 2) Build a short, precise summary prompt
    base_prompt = (
        f"Explain the cybersecurity concept '{concept}' in ~160 words. "
        "Be precise and accurate, aimed at an undergraduate security student. "
        "Highlight why it matters, 2–3 key components, and one typical real-world example. "
        "Do NOT invent references; just describe the concept."
    )

    gemini_summary = ask_gemini(base_prompt)
    gpt_summary = ask_gpt(base_prompt)

    return ConceptResponse(
        ok=True,
        concept=concept,
        gemini_summary=gemini_summary,
        gpt_summary=gpt_summary,
        sources=sources,
    )
