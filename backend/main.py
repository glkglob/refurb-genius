"""
Refurb Genius - FastAPI + CrewAI Backend
Entry point for Railway deployment (separate from Vercel frontend).

This is a minimal production-ready skeleton. Extend with CrewAI crews,
property analysis endpoints, etc. See RAILWAY_SETUP.md and property-intel/
for existing CrewAI patterns to port.
"""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
import httpx
from fastapi import FastAPI, HTTPException, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from supabase import create_client, Client

# Load .env for local dev (Railway injects env vars automatically)
load_dotenv()

# --- Settings (pydantic-settings) ---
class Settings(BaseSettings):
    # Required for Railway backend
    supabase_url: str
    supabase_service_role_key: str
    openai_api_key: str

    # Optional / future
    environment: str = "production"
    frontend_url: str = "https://www.refurbgenius.info"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()


# --- Pydantic Models for Analysis Jobs ---
class PropertyAnalysisInput(BaseModel):
    """Flexible input for property / deal analysis (covers Deal Copilot + property-intel style)."""
    property_address: str | None = None
    postcode: str | None = None
    region: str | None = None
    property_type: str | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    purchase_price: float | None = None
    estimated_gdv: float | None = None
    condition: str | None = None
    notes: str | None = None
    # Allow extra free-form fields from frontend
    model_config = {"extra": "allow"}


class JobCreateResponse(BaseModel):
    job_id: str
    status: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    created_at: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    failed_at: str | None = None


class JobResultResponse(BaseModel):
    job_id: str
    status: str
    result: dict[str, Any] | None = None
    error_message: str | None = None


# --- FastAPI App ---
app = FastAPI(
    title="Refurb Genius API",
    description="FastAPI + CrewAI backend for property refurb analysis. Deployed on Railway.",
    version="0.1.0",
)

# --- CORS (production-safe, explicit origins only) ---
# Never use allow_origins=["*"] together with allow_credentials=True
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",  # Vite dev server default
    "http://127.0.0.1:3000",
    "https://www.refurbgenius.info",
    # Update this with your actual Vercel production URL (and any preview patterns if needed)
    # Example: "https://refurb-genius-abc123.vercel.app",
    settings.frontend_url,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# --- Supabase Service-Role Client (backend only — never exposed to frontend) ---
def get_supabase_service_client() -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase credentials not configured for backend")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


# --- AI Analysis Runner (safe working placeholder) ---
# The original property-intel/property_intelligence.py contains syntax errors
# (incomplete Agent/Task/Crew construction). This function provides a real,
# immediately usable AI path using the same OPENAI_API_KEY as the rest of
# the platform. TODO: Replace the body with a real CrewAI crew once the
# property-intel script and dependencies are cleaned up.
async def run_property_analysis(input_data: dict[str, Any]) -> dict[str, Any]:
    """
    Execute property intelligence / refurb analysis.
    Returns structured result suitable for storage in result_payload.
    """
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required for analysis")

    # Build a concise but high-signal prompt (keeps cost and latency reasonable for v1)
    address = input_data.get("property_address") or input_data.get("postcode") or "UK property"
    prompt = f"""You are an expert UK residential refurbishment analyst.

Property details:
{input_data}

Produce a concise professional property intelligence report as STRICT JSON with these exact keys:
- summary: short 2-3 sentence overview
- key_findings: array of 4-6 bullet strings (condition, opportunities, risks)
- refurb_estimate_low: integer GBP (realistic low-end total refurb cost)
- refurb_estimate_high: integer GBP (realistic high-end)
- recommended_works: array of 3-6 strings
- roi_notes: 1-2 sentences on investment angle
- confidence: number 0-100

Respond with ONLY the JSON object, no markdown, no extra text."""

    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are a precise JSON-only property analyst."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "max_tokens": 800,
    }

    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    content = data["choices"][0]["message"]["content"]
    try:
        result = json.loads(content) if isinstance(content, str) else content
    except Exception:
        result = {"summary": content or "Analysis completed", "raw": content}

    # Ensure expected keys exist for frontend
    result.setdefault("summary", "Property analysis completed via Railway backend.")
    result.setdefault("refurb_estimate_low", 35000)
    result.setdefault("refurb_estimate_high", 85000)
    result.setdefault("key_findings", [])
    result.setdefault("recommended_works", [])
    result.setdefault("roi_notes", "Run full numbers in the deterministic pricing engine.")
    result.setdefault("confidence", 75)

    return result


# --- Job Lifecycle Helpers (use service role from Railway) ---
async def create_analysis_job(user_id: str, input_payload: dict[str, Any]) -> str:
    supabase = get_supabase_service_client()
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    supabase.table("analysis_jobs").insert({
        "id": job_id,
        "user_id": user_id,
        "status": "pending",
        "input_payload": input_payload,
        "created_at": now,
        "updated_at": now,
    }).execute()

    return job_id


async def update_job_status(
    job_id: str,
    status: str,
    *,
    started_at: str | None = None,
    completed_at: str | None = None,
    failed_at: str | None = None,
    result_payload: dict[str, Any] | None = None,
    error_message: str | None = None,
):
    supabase = get_supabase_service_client()
    now = datetime.now(timezone.utc).isoformat()

    update: dict[str, Any] = {"status": status, "updated_at": now}
    if started_at:
        update["started_at"] = started_at
    if completed_at:
        update["completed_at"] = completed_at
    if failed_at:
        update["failed_at"] = failed_at
    if result_payload is not None:
        update["result_payload"] = result_payload
    if error_message is not None:
        update["error_message"] = error_message

    supabase.table("analysis_jobs").update(update).eq("id", job_id).execute()


async def get_job(job_id: str) -> dict[str, Any] | None:
    supabase = get_supabase_service_client()
    res = supabase.table("analysis_jobs").select("*").eq("id", job_id).limit(1).execute()
    if res.data:
        return res.data[0]
    return None


# --- Background Job Processor ---
async def process_analysis_job(job_id: str, input_payload: dict[str, Any]):
    started = datetime.now(timezone.utc).isoformat()
    await update_job_status(job_id, "processing", started_at=started)

    try:
        result = await run_property_analysis(input_payload)
        completed = datetime.now(timezone.utc).isoformat()
        await update_job_status(
            job_id,
            "completed",
            completed_at=completed,
            result_payload=result,
        )
    except Exception as exc:
        failed = datetime.now(timezone.utc).isoformat()
        await update_job_status(
            job_id,
            "failed",
            failed_at=failed,
            error_message=str(exc)[:2000],
        )


# --- Health & Readiness (for Railway + monitoring) ---
@app.get("/health", tags=["system"])
async def health_check():
    """Simple health endpoint for Railway, load balancers, and uptime checks."""
    return {
        "status": "healthy",
        "service": "refurb-genius-backend",
        "environment": settings.environment,
        "version": "0.1.0",
    }


@app.get("/ready", tags=["system"])
async def readiness_check():
    """Readiness probe - extend with DB / LLM connectivity checks later."""
    # TODO: add Supabase ping or OpenAI lightweight check when wiring real endpoints
    return {"status": "ready"}


@app.get("/debug/connectivity", tags=["system"])
async def debug_connectivity():
    """
    Debug endpoint to test outbound connectivity from the backend.
    Very useful when getting DNS / connection errors.
    """
    results: dict[str, Any] = {}

    # 1. Test Supabase connection
    supabase_url = settings.supabase_url or "NOT SET"
    results["supabase_url"] = supabase_url if not supabase_url or "supabase.co" not in supabase_url else supabase_url.split(".supabase.co")[0] + ".supabase.co"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(supabase_url + "/rest/v1/", headers={"apikey": settings.supabase_service_role_key or ""})
            results["supabase"] = {
                "status": "ok" if resp.status_code < 500 else "error",
                "status_code": resp.status_code,
                "note": "Supabase reachable"
            }
    except Exception as exc:
        results["supabase"] = {
            "status": "failed",
            "error": str(exc),
            "error_type": type(exc).__name__,
            "note": "Cannot reach Supabase. Check SUPABASE_URL in .env and internet/DNS."
        }

    # 2. Test basic internet + OpenAI DNS
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get("https://api.openai.com", timeout=6.0)
            results["openai_dns"] = {
                "status": "ok",
                "status_code": resp.status_code,
                "note": "OpenAI hostname resolves"
            }
    except Exception as exc:
        results["openai_dns"] = {
            "status": "failed",
            "error": str(exc),
            "error_type": type(exc).__name__,
            "note": "Cannot resolve api.openai.com — DNS or internet issue from this Python process"
        }

    import sys
    results["python_version"] = sys.version
    results["tip"] = "If you see DNS errors here but normal curl works, the issue is usually with the Python installation (especially Python 3.14 on macOS) or .env values."

    return results


@app.get("/", tags=["system"])
async def root():
    return {
        "message": "Refurb Genius Backend (Railway)",
        "docs": "/docs",
        "health": "/health",
        "endpoints": ["/analyze-property", "/analysis-status/{job_id}", "/analysis-result/{job_id}"],
        "note": "Async property analysis powered by Railway. Frontend uses VITE_API_BASE_URL.",
    }


# --- Analysis Job Endpoints (called by frontend via VITE_API_BASE_URL) ---

@app.post("/analyze-property", response_model=JobCreateResponse, tags=["analysis"])
async def analyze_property(
    payload: PropertyAnalysisInput,
    background_tasks: BackgroundTasks,
    # In production the frontend would send Authorization: Bearer <supabase_jwt>
    # For v1 we accept user_id in body or header; here we take a simple header for demo.
    # Real implementation should use verifyToken pattern or Supabase JWT validation.
    x_user_id: str = Header(None, alias="X-User-Id"),
):
    """
    Start an async property analysis job on Railway.
    Returns immediately with job_id. Frontend polls status/result.
    """
    user_id = x_user_id or "00000000-0000-0000-0000-000000000000"  # fallback for local testing

    # Convert Pydantic model to dict (allow extra fields)
    input_dict = payload.model_dump(exclude_none=True)

    job_id = await create_analysis_job(user_id, input_dict)

    # Kick off the (potentially long) AI work in the background
    background_tasks.add_task(process_analysis_job, job_id, input_dict)

    return JobCreateResponse(job_id=job_id, status="pending")


@app.get("/analysis-status/{job_id}", response_model=JobStatusResponse, tags=["analysis"])
async def get_analysis_status(job_id: str):
    job = await get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    return JobStatusResponse(
        job_id=job["id"],
        status=job["status"],
        created_at=job.get("created_at"),
        started_at=job.get("started_at"),
        completed_at=job.get("completed_at"),
        failed_at=job.get("failed_at"),
    )


@app.get("/analysis-result/{job_id}", response_model=JobResultResponse, tags=["analysis"])
async def get_analysis_result(job_id: str):
    job = await get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    return JobResultResponse(
        job_id=job["id"],
        status=job["status"],
        result=job.get("result_payload"),
        error_message=job.get("error_message"),
    )


# --- Example placeholder for future CrewAI routes ---
# from .routers import crew, analysis
# app.include_router(crew.router, prefix="/v1/crew", tags=["crewai"])
# app.include_router(analysis.router, prefix="/v1/analysis", tags=["analysis"])


# --- Startup / Shutdown (extend for Crew init, Supabase client) ---
@app.on_event("startup")
async def on_startup():
    # Validate critical env vars early
    if not settings.openai_api_key:
        print("WARNING: OPENAI_API_KEY is not set")
    if not settings.supabase_url or not settings.supabase_service_role_key:
        print("WARNING: Supabase credentials incomplete")
    print(f"Refurb Genius backend starting in {settings.environment} mode")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
