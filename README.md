# FitMe

A try-on app that builds a faithful, consistent digital likeness of a user and renders any garment onto it. Upload photos once, then try on as many clothes as you want — same body, same lighting, same pose, every time.

See [`FITME_PROJECT.md`](./FITME_PROJECT.md) for the full architecture and design rationale.

---

## Quick start (Docker — recommended)

You'll need: **Docker Desktop** (Windows/Mac) and a **FAL.ai API key**.

1. Get a FAL key at https://fal.ai/dashboard/keys (free tier is enough for development).
2. Copy and fill the backend env:

   ```powershell
   Copy-Item backend\.env.example backend\.env
   notepad backend\.env
   ```

   At minimum set:

   ```
   FAL_KEY=<your-fal-key>
   JWT_SECRET_KEY=<any-long-random-string>
   ```

3. Start everything:

   ```powershell
   docker compose up --build
   ```

4. Open the app at <http://localhost:3000>.
   The API runs at <http://localhost:8000> with auto-generated docs at <http://localhost:8000/docs>.

The first build takes a few minutes (Playwright + rembg model downloads). Subsequent starts are fast.

---

## Quick start (without Docker — Windows native)

If you'd rather develop without Docker, you need: **Python 3.11**, **Node 20**, **PostgreSQL 16** running locally.

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m playwright install chromium
Copy-Item .env.example .env
# Edit .env — at minimum, FAL_KEY and DATABASE_URL pointing at your local Postgres
notepad .env
uvicorn app.main:app --reload
```

### Frontend

In a separate terminal:

```powershell
cd frontend
npm install
Copy-Item .env.local.example .env.local
npm run dev
```

---

## How it works

1. **Sign up** at `/register`, then upload **3–8 photographs** of yourself at `/onboard`.
2. The backend scores each photo for **frontality** (face size + centeredness) using OpenCV and promotes the strongest frame to your **canonical avatar**.
3. In the **Studio** (`/studio`), paste a product URL or upload a garment image.
4. The backend scrapes the page (Playwright + BeautifulSoup), removes the background (`rembg`), uploads both the avatar and garment to FAL's CDN, then submits a try-on request to **`fal-ai/idm-vton`** (swappable via env var).
5. The job runs as a FastAPI background task that polls FAL's queue API. The frontend polls our API every 2 s for status.
6. When done, the resulting image is downloaded and stored in our object storage, and the studio reveals the result.

Because we always use the **same base photo** and modern try-on models only modify the garment region, the user's face, body, hair, skin tone, lighting, and background remain consistent across every try-on.

---

## Storage modes

The backend has a pluggable storage layer. Set `STORAGE_BACKEND`:

- **`local`** (default) — files are written to `backend/.storage` and served by the API at `/files/<key>`. Best for development.
- **`r2`** — Cloudflare R2 (S3-compatible). Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and either `R2_PUBLIC_URL` (a custom domain) or rely on presigned URLs.

---

## Swapping the try-on model

Change `FAL_TRYON_MODEL` in `backend/.env`. The backend already knows the payload shapes for:

- `fal-ai/idm-vton` — default; strong identity preservation
- `fal-ai/leffa` — newer, very fast, often more natural
- `fal-ai/cat-vton` — efficient, good for tops

For models with different payload shapes, edit `_payload_for_model()` in `backend/app/services/tryon_service.py`.

---

## Project layout

```
VTO/
├── backend/                FastAPI + SQLAlchemy + FAL integration
│   ├── app/
│   │   ├── routers/        HTTP endpoints
│   │   ├── services/       business logic (auth, storage, scraper, tryon, …)
│   │   └── models/         SQLAlchemy ORM models
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/               Next.js 14 + TypeScript + Tailwind
│   └── src/
│       ├── app/            App Router pages (/, /login, /register, /onboard, /studio)
│       ├── components/
│       └── lib/
├── docker-compose.yml
├── FITME_PROJECT.md        Architecture & design doc
└── README.md
```

---

## What's NOT in the MVP

- Social/sharing features
- Style recommendations
- Store browsing/search
- Multiple avatars per user
- Subscriptions
- Avatar normalization (re-rendering you into neutral clothes) — planned v1.1 with Flux Kontext

---

## License

This repo is yours. Do what you want with it.
