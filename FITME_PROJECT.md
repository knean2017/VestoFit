# FitMe — MVP Project Context

> Last updated: 2026-05-28. Reflects locked architecture decisions for the MVP.

---

## What This App Does

FitMe lets a user upload photos of themselves **once**, then repeatedly try on different clothes — with **consistent** appearance every time (same body, same pose, same lighting, same face). Only the clothes change.

**Core flow:**
1. User uploads 3–5 photos of themselves (one-time setup).
2. App auto-selects the best frontal photo and stores it as the **canonical base photo**.
3. User pastes a clothing product URL **or** uploads a garment image.
4. App generates a realistic image of the user wearing that garment.
5. User sees the result in ~10–30 seconds.

**MVP scope only.** No social features, no store search, no stylist AI. Just the try-on loop, working well, with consistent output.

---

## Why the avatar is "consistent" (important)

The user's main requirement is that the *same person* shows up in every try-on — same lighting, same pose, same body shape. We achieve this **without** generating a synthetic avatar (which would lose the user's real body).

Key insight: modern diffusion-based try-on models (IDM-VTON, Leffa, CatVTON-FLUX) **only modify the garment region** of the source image. Everything else — face, hair, skin, body shape, background, lighting — is preserved untouched.

So consistency is automatic if we always feed the **same base photo** into the model. No avatar generation needed for MVP.

### Stretch goal — Avatar normalization (v1.1, not MVP)
Optionally we add a one-time "normalize" pass using FAL's **Flux Kontext** model (instruction-tuned image editor) that takes the user's best photo and produces a canonical version: frontal pose, white tee + jeans, neutral studio lighting, clean background — while preserving the user's identity AND body proportions. The downstream pipeline is identical. Off for MVP.

---

## Locked Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 14 (App Router) + TypeScript + TailwindCSS** | Fast to build, beautiful UI |
| Backend API | **FastAPI** (Python 3.11), async | Fast, type-safe |
| Try-On Model | **FAL.ai → `fal-ai/idm-vton`** (default), swappable to Leffa/Kling | Body-preserving, ~$0.03–0.05/gen, no GPU plumbing |
| Frontality scoring | **OpenCV Haar cascade** (face size + centeredness) | Pick the best frontal photo. No model downloads, cross-platform. |
| Background Removal | **rembg** (lightweight) | Cleans user-uploaded garments |
| Database | **PostgreSQL 16** | Local in Docker |
| File Storage | **Pluggable: local FS (dev) or Cloudflare R2 (prod)** | Toggle via `STORAGE_BACKEND` env var. Local default for dev. |
| Scraping | **Playwright + BeautifulSoup4** | JS-rendered retail pages |
| Auth | **JWT (python-jose)** | Simple, local-friendly |
| Async work | **FastAPI `BackgroundTasks`** for MVP (no Celery) | FAL handles GPU queueing; we just poll |
| Containers | **Docker Compose** | Postgres + backend + frontend, one command |

### What we removed from the original plan and why
- **Celery + Redis** — FAL handles the GPU queue, so we only need lightweight in-process background tasks for polling. We can upgrade to Celery later if we add more async work.
- **Self-hosted Modal worker** — Adds 1–2 weeks of infra plumbing. FAL gives us the same result for ~the same per-call cost with zero setup. Swap to self-hosted only when economics demand it.
- **SAM** — Overkill for garment background removal. `rembg` (built on U²-Net) is ~50x lighter and good enough.

---

## Storage Abstraction

`StorageService` exposes a generic interface (`save_bytes`, `presigned_url`, `delete`). Two implementations:
- `LocalStorage` — writes to `./.storage/` on disk, serves via `/files/{key}` endpoint. Default.
- `R2Storage` — S3-compatible client to Cloudflare R2. Activated by `STORAGE_BACKEND=r2`.

This lets us develop fully offline and flip to R2 with one env var when we deploy.

---

## Project Structure

```
fitme/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI app entry, mounts routers + /files
│   │   ├── config.py              # Pydantic Settings (env vars)
│   │   ├── database.py            # SQLAlchemy async engine
│   │   ├── deps.py                # Auth dependency, db dependency
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── avatar.py
│   │   │   └── job.py
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   ├── avatar.py
│   │   │   └── tryon.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── avatar.py
│   │   │   ├── tryon.py
│   │   │   └── files.py           # Serves local-storage files in dev
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── storage/
│   │   │   │   ├── base.py        # StorageService protocol
│   │   │   │   ├── local.py       # LocalStorage
│   │   │   │   └── r2.py          # R2Storage
│   │   │   ├── pose_service.py    # MediaPipe — pick best frontal photo
│   │   │   ├── avatar_service.py  # Avatar creation logic
│   │   │   ├── scraper_service.py # URL → garment image
│   │   │   ├── garment_service.py # rembg background removal
│   │   │   └── tryon_service.py   # FAL.ai integration + polling
│   │   └── workers/
│   │       └── tryon_poller.py    # Background task: polls FAL job
│   ├── alembic/                   # Migrations
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx           # Landing / login
│   │   │   ├── onboard/page.tsx   # Avatar upload flow
│   │   │   └── tryon/page.tsx     # Main try-on UI
│   │   ├── components/
│   │   │   ├── AvatarUpload.tsx
│   │   │   ├── GarmentInput.tsx
│   │   │   ├── TryOnResult.tsx
│   │   │   └── ui/                # Shared primitives
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── auth.ts
│   │   └── styles/globals.css
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.mjs
│   └── Dockerfile
│
├── docker-compose.yml             # postgres + backend + frontend
├── .gitignore
└── README.md
```

---

## AI Pipeline

```
User Photos (3–5)
      │
      ▼
[Avatar Service]
  - OpenCV face detector scores frontality of each photo
  - Store all photos
  - Mark highest-scoring photo as base_photo
      │
      ▼
[Garment Input]
  - URL path: Playwright fetches page → picks og:image → cleans bg with rembg
  - Upload path: user uploads photo directly → rembg
      │
      ▼
[Try-On via FAL.ai IDM-VTON]
  - Input: presigned URL of base_photo + presigned URL of garment
  - FAL returns request_id immediately
  - Our background task polls FAL for completion (~10–25s typical)
  - Download result, save to our storage, update job
      │
      ▼
[Result]
  - Frontend (which has been polling our `/tryon/{id}`) sees status=completed
  - Displays result image
```

---

## Job Flow

```
POST /tryon/url  ─►  validate auth, create job (status=queued)
                     enqueue BackgroundTask(run_tryon, job_id)
                     return { job_id }
                                     │
                                     ▼
                     scrape garment → upload to storage
                                     ▼
                     status=processing
                                     ▼
                     POST to FAL.ai with person + garment URLs
                                     ▼
                     poll FAL every 2s up to 90s
                                     ▼
                     download result, save to storage
                                     ▼
                     status=completed, result_url set

GET /tryon/{id}  ─►  { status, result_url?, error? }
```

Frontend polls `GET /tryon/{job_id}` every 2 s.

---

## Database Schema

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR UNIQUE NOT NULL,
    hashed_password VARCHAR NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE avatars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    photo_keys TEXT[] NOT NULL,        -- storage keys, not full URLs
    base_photo_key TEXT NOT NULL,      -- the chosen frontal photo
    pose_scores JSONB,                 -- per-photo frontality scores
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tryon_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    avatar_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
    garment_key TEXT,                  -- storage key of the scraped/uploaded garment
    source_url TEXT,                   -- original retail URL if any
    category VARCHAR NOT NULL DEFAULT 'tops',  -- tops | bottoms | dresses
    description TEXT,                  -- optional free-text garment description
    fal_request_id TEXT,               -- FAL.ai request id, for polling
    status VARCHAR NOT NULL DEFAULT 'queued',
                                       -- queued | processing | completed | failed
    result_key TEXT,                   -- storage key of final image
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_tryon_jobs_user ON tryon_jobs(user_id, created_at DESC);
```

---

## Environment Variables

```bash
# backend/.env

# --- Database ---
DATABASE_URL=postgresql+asyncpg://fitme:fitme@db:5432/fitme

# --- Auth ---
JWT_SECRET_KEY=change-me-to-a-32-char-random-string-now
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080            # 7 days

# --- Storage ---
STORAGE_BACKEND=local               # local | r2
STORAGE_LOCAL_DIR=./.storage
STORAGE_PUBLIC_BASE_URL=http://localhost:8000/files   # used by local backend
# Only required if STORAGE_BACKEND=r2:
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=fitme-assets
R2_PUBLIC_URL=

# --- AI ---
FAL_KEY=                            # required, from fal.ai
FAL_TRYON_MODEL=fal-ai/idm-vton     # default; alternatives: fal-ai/leffa, fal-ai/cat-vton

# --- App ---
APP_ENV=dev
CORS_ORIGINS=http://localhost:3000
```

---

## API Endpoints

```
AUTH
  POST /auth/register       { email, password } → { access_token }
  POST /auth/login          { email, password } → { access_token }
  GET  /auth/me             → { id, email }

AVATAR
  POST /avatar/upload       multipart: photos[] → { avatar_id, base_photo_url }
  GET  /avatar/me           → { avatar_id, base_photo_url, photo_urls[] }
  DELETE /avatar/me         → 204

TRY-ON
  POST /tryon/url           { garment_url: "https://zara.com/..." } → { job_id }
  POST /tryon/upload        multipart: garment_image           → { job_id }
  GET  /tryon/{job_id}      → { status, result_url?, error? }
  GET  /tryon/history       → [ { job_id, result_url, garment_url, created_at } ]

FILES (dev only — local storage backend)
  GET /files/{key}          → serves the bytes
```

---

## FAL.ai Try-On — Notes

- IDM-VTON inputs:
  ```json
  {
    "human_image_url": "...",
    "garment_image_url": "...",
    "garment_description": "shirt",      // free text helps the model
    "category": "tops"                   // tops | bottoms | dresses
  }
  ```
- Returns a synchronous response on warm runs (~8–15s) or asynchronous request_id on long runs. We always submit async and poll `https://queue.fal.run/{model}/requests/{request_id}` until status == `COMPLETED`.
- ~$0.03–0.05 per generation.
- Garment category is currently inferred from the source URL (zara has `/men/shirts/` etc.) with `tops` as default fallback. We can ask the user later.

---

## Scraper Service — Notes

- **Playwright headless Chromium**; do not use plain `requests` (most retail pages are JS-rendered).
- Extraction order:
  1. `<meta property="og:image">` — main product image ~80% of the time.
  2. JSON-LD `image` field from Product schema.
  3. Largest `<img>` inside `[class*="product"]`.
- Caching: hash the URL; if we've scraped it in the last 24h, reuse the cached image.
- Hard fail returns a clear error to the frontend, which then prompts the user to upload the garment image manually.

---

## What is NOT in MVP

- No social/sharing features
- No style recommendations
- No store search or product browsing
- No multiple avatars per user
- No video try-on
- No body measurement input
- No subscription/payments
- No Celery / Redis (FAL is the queue)
- No avatar normalization (Flux Kontext) — v1.1

---

## Realism / Quality Guardrails (built into MVP)

- **Garment category inference** — better results when we tell IDM-VTON if it's tops/bottoms/dresses.
- **Frontality scoring** — bad base photos = bad results, so we score and pick the best one and warn the user if all photos are weak.
- **Result re-roll button** — one tap to regenerate with a different seed. Diffusion is non-deterministic; this dramatically improves perceived quality.
- **Garment background removal** before try-on — IDM-VTON works much better with clean garments.

---

## Current Status

- [x] Architecture locked
- [ ] Project scaffolded
- [ ] Docker Compose running locally
- [ ] FastAPI skeleton with auth
- [ ] Database models + Alembic migrations
- [ ] Storage service (local + R2)
- [ ] Avatar upload + pose-based selection
- [ ] FAL.ai try-on integration + polling
- [ ] Scraper service
- [ ] Frontend distinctive UI
- [ ] End-to-end test with real photos

---
