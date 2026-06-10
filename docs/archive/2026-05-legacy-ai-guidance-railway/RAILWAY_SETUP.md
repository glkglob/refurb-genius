# Railway Backend Deployment Setup (FastAPI + CrewAI)

> **ARCHIVED — May 2026.** The Railway/Python backend was decommissioned and removed
> from the repo. Current AI architecture: pure TypeScript `createServerFn` + OpenAI.
> See [`docs/architecture/ai-platform.md`](../../architecture/ai-platform.md) and
> [`docs/archive/2026-05-legacy-ai-guidance-railway/README.md`](./README.md).
> **Do not follow deployment steps below.**

---

This document prepared the **FastAPI/CrewAI backend** for deployment on Railway while the **frontend (TanStack Start / Vite)** remained on Vercel.

## Current State (as of setup)

- No FastAPI backend existed in the repo prior to this setup.
- The only Python code was a local CLI CrewAI script: `property-intel/property_intelligence.py`.
- AI features currently execute via TanStack `createServerFn` + OpenAI calls inside `src/core/ai/server/*.server.ts` (co-located with frontend on Vercel).
- A minimal, production-ready FastAPI skeleton has been added at `backend/` to enable the split.

## 1. Railway Configuration

### Root Directory

**Set this in Railway project settings (or during first deploy):**

```text
/backend
```

This tells Railway to treat `backend/` as the app root (so `Procfile`, `requirements.txt`, and `main.py` are found directly).

### Start Command

Railway auto-detects the `Procfile`. The command is:

```text
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Alternative (if overriding in Railway dashboard):**

```text
uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Never hardcode a port.** Always use `$PORT`.

### Build Command (Railway)

Default (`pip install -r requirements.txt`) is usually sufficient. If you add a `runtime.txt`, set:

```
python-3.11
```

(or 3.12 / 3.10 as preferred).

## 2. Required Environment Variables

### Railway (Backend)

Add these in Railway → Project → Variables (or per-environment):

| Variable                    | Example / Source              | Required | Notes                                                                          |
| --------------------------- | ----------------------------- | -------- | ------------------------------------------------------------------------------ |
| `SUPABASE_URL`              | https://YOUR_REF.supabase.co  | Yes      | From Supabase project settings                                                 |
| `SUPABASE_SERVICE_ROLE_KEY` | eyJ... (service_role jwt)     | Yes      | **Server-only**. Use for admin/privileged operations. Never expose to browser. |
| `OPENAI_API_KEY`            | sk-...                        | Yes      | For CrewAI + direct OpenAI calls                                               |
| `ENVIRONMENT`               | production                    | No       | Defaults to "production"                                                       |
| `FRONTEND_URL`              | https://www.refurbgenius.site | No       | Used for CORS                                                                  |

### Vercel (Frontend)

Add this so the frontend knows where to call the Railway backend:

| Variable            | Value Example                       | Notes                                                                                                                   |
| ------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | https://your-backend.up.railway.app | **Use `VITE_` prefix** (this is a Vite/TanStack project, not Next.js). Add to both Production and Preview environments. |

> **Note on prefixes**: The codebase supports both `VITE_*` and `NEXT_PUBLIC_*` in many places for compatibility, but prefer `VITE_API_BASE_URL` for new public client vars.

## 3. Local Development & Testing (Backend)

```bash
cd backend

# Create venv (recommended)
python -m venv .venv
source .venv/bin/activate   # macOS/Linux
# .venv\Scripts\activate   # Windows

pip install -r requirements.txt

# Run with auto-reload (uses PORT=8000 by default in __main__)
uvicorn main:app --reload --port 8000
```

Or via the script in main.py:

```bash
python main.py
```

### Health Check (local)

```bash
curl http://localhost:8000/health
# Expected:
# {"status":"healthy","service":"refurb-genius-backend",...}
```

### Readiness

```bash
curl http://localhost:8000/ready
```

### API Docs (local)

http://localhost:8000/docs (Swagger UI)

## 4. CORS Configuration (Already Implemented Safely)

In `backend/main.py`:

- Explicit allowlist (no `["*"]` + credentials anti-pattern).
- Current allowed:
  - `http://localhost:3000`
  - `http://localhost:5173` (Vite)
  - `https://www.refurbgenius.site`
  - Your `FRONTEND_URL` / placeholder for Vercel prod URL

**Update the list in `main.py` when you have the exact Vercel production URL(s).**

## 5. Connecting Frontend → Railway Backend (Future)

When you extract or add new endpoints (e.g. `/v1/crew/property-intel`):

1. In frontend code, read the base:

   ```ts
   const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
   ```

2. Call it from client or (preferred) from a new `createServerFn` that proxies to Railway (keeps keys server-only).

3. Gradually move heavy CrewAI work (long-running crews, many tool calls) from Vercel server functions to Railway.

Existing patterns to port:

- `property-intel/property_intelligence.py` (CrewAI + Grok + tools)
- `src/core/ai/server/*.server.ts` (current OpenAI + structured outputs)

## 6. Common Mistakes & Gotchas

- **CORS error**: Using `allow_origins=["*"]` + `allow_credentials=True` → FastAPI will reject. Always use explicit list.
- **Port issues**: Hardcoding `port=8000` or forgetting `$PORT` → Railway health checks fail.
- **Missing env vars**: Backend will 500 on startup or first request if `SUPABASE_*` or `OPENAI_API_KEY` are absent. Settings validates at import time.
- **Root directory wrong**: If you set Railway root to `/` instead of `/backend`, it will look for `requirements.txt` in the monorepo root (which has none for Python) and fail.
- **Committing secrets**: Never commit real `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY`. Use Railway/Vercel secret injection + `.env.example`.
- **Vite vs Next.js env**: Using `NEXT_PUBLIC_API_BASE_URL` works in some compat layers but **prefer `VITE_API_BASE_URL`** for this project.
- **CrewAI cold starts**: Railway free tier sleeps. Use always-on or add lightweight health pings if latency matters.
- **Python version**: Pin via `runtime.txt` if you see dependency resolution issues with crewai/langchain.
- **Supabase RLS**: When using service role from Railway, you bypass RLS. Use carefully; prefer user-scoped clients where possible.
- **Large deps**: `crewai` + tools pulls in a lot. First deploy may take several minutes.

## 9. Local Testing Commands (Backend + Frontend Split)

### 1. Run the Railway backend locally

**Recommended (easiest):**

```bash
cd backend
./start.sh
```

This script will:

- Create a `.venv` if needed
- Install dependencies
- Warn you if `.env` is missing
- Start uvicorn with reload

**Manual setup (if you prefer):**

```bash
cd backend

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Create .env from the example (then fill in your keys)
cp .env.example .env

uvicorn main:app --reload --port 8000
```

### 2. Test health

```bash
curl http://localhost:8000/health
```

### 3. Start a property analysis job (replace the UUID with a real auth user id in production)

```bash
curl -X POST http://localhost:8000/analyze-property \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 00000000-0000-0000-0000-000000000000" \
  -d '{
    "property_address": "42 Example Road, London",
    "postcode": "SW1A 1AA",
    "region": "London",
    "bedrooms": 3,
    "condition": "Average",
    "notes": "Needs kitchen and bathroom update"
  }'
# Returns: { "job_id": "...", "status": "pending" }
```

### 4. Poll status

```bash
curl http://localhost:8000/analysis-status/<job_id>
```

### 5. Fetch result (once completed)

```bash
curl http://localhost:8000/analysis-result/<job_id>
```

### 6. Run the frontend locally against the local backend

```bash
# In project root
VITE_API_BASE_URL=http://localhost:8000 pnpm dev
```

Then navigate to a project → Scope page and click **"Run Full Property Intelligence (Railway)"**.

You should see the job move pending → processing → completed and a result JSON appear.

**Note**: The X-User-Id header is a v1 convenience. Production should validate the Supabase JWT sent from the authenticated frontend session.

## 7. Recommended Next Steps

1. Deploy the `backend/` skeleton to Railway first (verify `/health`).
2. Add `VITE_API_BASE_URL` to Vercel.
3. Implement real endpoints (start with a thin wrapper around the logic in `property-intel/`).
4. Update frontend to call the new endpoints (optionally via server functions for auth).
5. Move or duplicate any shared Supabase client creation logic.
6. Add Railway health checks / metrics / alerts.
7. (Optional) Add a `backend/.env.example` and update root `.env.example`.

## 8. Files Added / Changed in Async Wiring

**Backend**

- `backend/main.py` — Added `/analyze-property`, status & result endpoints, Supabase service-role job persistence, background processor, working OpenAI-based analysis runner (safe placeholder for the broken CrewAI script).

**Supabase**

- `supabase/migrations/20260524100000_create_analysis_jobs.sql` — New table with status enum constraint, jsonb payloads, timestamps, RLS policies.

**Frontend (smallest safe additions)**

- `src/lib/api/railwayAnalysis.ts` — Client with `startAnalysis`, `getAnalysisStatus`, `getAnalysisResult`, `pollAnalysisResult` using `VITE_API_BASE_URL`.
- `src/hooks/useRailwayPropertyAnalysis.ts` — Hook encapsulating the full start + poll + state machine.
- `src/routes/projects.$id.scope.tsx` — Added one secondary "Run Full Property Intelligence (Railway)" button + minimal status/result display (existing direct AI paths untouched).

**Docs**

- `RAILWAY_SETUP.md` — Extended with local testing commands, updated file list, and current architecture notes.

## Support

- Railway docs: https://docs.railway.app/
- FastAPI deployment: https://fastapi.tiangolo.com/deployment/
- For CrewAI patterns see `property-intel/property_intelligence.py` and the skills/docs in the repo.

Once the first deploy succeeds and `/health` returns 200 from the Railway URL, the split deployment foundation is complete.
