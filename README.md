# FitMe

Your AI-powered wardrobe assistant. Upload your clothes, get outfit suggestions from a personal stylist, try on any garment virtually, and shop for new pieces — all through natural conversation.

See [`FITME_PROJECT.md`](./FITME_PROJECT.md) for the full architecture and design rationale.

---

## Features

- **AI Stylist** — Chat with your personal stylist on the home page. Asks about your occasion, suggests outfits from your wardrobe, and guides new users to build their closet — all through free-form conversation.
- **Virtual Try-On** — Upload a garment image or paste a product URL. The app renders it on your photo with consistent face, body, and lighting using FAL.ai try-on models.
- **Smart Wardrobe** — Snap photos of your clothes. AI auto-tags each item (category, color, pattern, formality, season). Browse with category filters on a hanging-rack UI with 3D closet door entrance.
- **AI-Powered Shopping** — Tell the stylist what you need ("summer dress under $80") and it searches for you. The AI decides whether to auto-search or ask follow-up questions. Manual filters available behind a toggle.
- **Immersive UI** — 3D closet doors (wardrobe), curtain-pull reveal (shop), mirror + glint sweep (studio). GSAP animations, Lenis smooth scroll, Framer Motion transitions. All gracefully degrade with `prefers-reduced-motion`.

---

## Quick start (Docker — recommended)

You'll need: **Docker Desktop** (Windows/Mac), a **FAL.ai API key**, and a **Gemini API key**.

1. Get API keys:
   - FAL key: https://fal.ai/dashboard/keys (free tier works for dev)
   - Gemini key: https://aistudio.google.com/apikey (free tier works for dev)

2. Copy and fill the backend env:

   ```powershell
   Copy-Item backend\.env.example backend\.env
   notepad backend\.env
   ```

   At minimum set:

   ```
   FAL_KEY=<your-fal-key>
   GEMINI_API_KEY=<your-gemini-key>
   JWT_SECRET_KEY=<any-long-random-string>
   ```

3. Start everything:

   ```powershell
   docker compose up --build
   ```

4. Open the app at http://localhost:3000.
   The API runs at http://localhost:8000 with auto-generated docs at http://localhost:8000/docs.

The first build takes a few minutes (Playwright + model downloads). Subsequent starts are fast.

**Troubleshooting:** If the frontend fails with "Module not found" errors after adding dependencies, remove the stale Docker volume:
```powershell
docker compose down
docker volume rm vto_frontend_node_modules
docker compose up --build
```

---

## Quick start (without Docker — Windows native)

You need: **Python 3.11**, **Node 20**, **PostgreSQL 16** running locally.

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m playwright install chromium
Copy-Item .env.example .env
# Edit .env — at minimum, FAL_KEY, GEMINI_API_KEY, and DATABASE_URL
notepad .env
uvicorn app.main:app --reload
```

### Frontend

In a separate terminal:

```powershell
cd frontend
npm install
npm run dev
```

---

## Pages

| Route | Name | Description |
|-------|------|-------------|
| `/` | Home | AI stylist conversation + outfit silhouette preview. Landing page for unauthenticated users. |
| `/wardrobe` | The Closet | 3D closet door entrance. Hanging-rack wardrobe with category tabs, add/edit/delete items. |
| `/shop` | The Boutique | Curtain-pull entrance. AI-driven shopping assistant with manual filter toggle. |
| `/studio` | The Dressing Room | Mirror reveal entrance. Virtual try-on via URL or upload. Polaroid render history. |
| `/stylist` | Stylist | Direct stylist conversation page. |
| `/onboard` | Onboard | Upload 3–8 photos to create your avatar. |
| `/settings` | Settings | Account preferences. |
| `/login` | Login | Sign in. |
| `/register` | Register | Create account. |

---

## How it works

1. **Sign up** at `/register`, then upload **3–8 photographs** at `/onboard`.
2. The backend scores each photo for **frontality** (face size + centeredness) using OpenCV and promotes the strongest frame to your **canonical avatar**.
3. In the **Wardrobe** (`/wardrobe`), upload clothing photos. The AI (Gemini) auto-tags each item with category, color, pattern, formality, and season.
4. On the **Home** page (`/`), chat with the AI stylist. It knows your wardrobe and suggests outfits for any occasion.
5. In the **Studio** (`/studio`), paste a product URL or upload a garment image. The backend scrapes the page, removes the background, and submits a try-on request to FAL.ai.
6. In the **Shop** (`/shop`), tell the AI what you're looking for. It searches and shows results, or asks clarifying questions first.

---

## API endpoints

### Auth
- `POST /auth/register` — Create account
- `POST /auth/login` — Sign in, returns JWT

### Wardrobe
- `GET /wardrobe` — List items
- `POST /wardrobe` — Upload item (image + category)
- `PATCH /wardrobe/{id}` — Update item metadata
- `DELETE /wardrobe/{id}` — Delete item

### Stylist
- `POST /stylist/suggest` — AI outfit suggestion from wardrobe
- `POST /stylist/reroll` — Re-roll suggestion
- `GET /stylist/messages` — Chat history

### Shopping
- `POST /shopping/search` — Manual product search with filters
- `POST /shopping/ask` — AI-driven shopping chat (returns reply + optional auto-search results)
- `GET /shopping/history` — Search history

### Try-On
- `POST /tryon/url` — Try on from product URL
- `POST /tryon/upload` — Try on from uploaded image
- `GET /tryon/status/{job_id}` — Job status
- `GET /tryon/history` — Render history

### Avatar
- `POST /onboard/upload` — Upload avatar photos
- `GET /avatar/me` — Current avatar

---

## Storage modes

Set `STORAGE_BACKEND` in `.env`:

- **`local`** (default) — Files in `backend/.storage`, served at `/files/<key>`. Best for development.
- **`r2`** — Cloudflare R2 (S3-compatible). Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.

---

## AI models

### Try-on (FAL.ai)

Set `FAL_TRYON_MODEL` in `.env`:

- `fal-ai/kling/v1-5/kolors-virtual-try-on` — default, best identity preservation
- `fal-ai/fashn/tryon/v1.6` — best for complex fabrics
- `fal-ai/cat-vton` — good for non-standard poses
- `fal-ai/idm-vton` — legacy
- `fal-ai/leffa` — fast

### LLM (Gemini)

Set `LLM_MODEL` in `.env`. Default: `gemini-2.5-flash-lite`. Used for wardrobe auto-tagging, stylist chat, and shopping intent parsing.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind 3, Framer Motion, GSAP, React Three Fiber, Lenis |
| Backend | FastAPI, SQLAlchemy (async), PostgreSQL 16, Pydantic |
| AI | Gemini 2.5 Flash-Lite (tagging + chat), FAL.ai (try-on + avatar editing) |
| Infra | Docker Compose, Cloudflare R2 (optional) |

---

## Project layout

```
VTO/
├── backend/                FastAPI + SQLAlchemy + FAL integration
│   ├── app/
│   │   ├── routers/        HTTP endpoints (auth, wardrobe, stylist, shopping, tryon)
│   │   ├── services/       Business logic (LLM, shopping, stylist, tryon, storage)
│   │   ├── models/         SQLAlchemy ORM models
│   │   └── schemas/        Pydantic request/response schemas
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/               Next.js 14 + TypeScript + Tailwind
│   └── src/
│       ├── app/            App Router pages
│       ├── components/     UI components (StylistChat, wardrobe/*, shop/*, studio/*)
│       └── lib/            API client, auth, GSAP setup, hooks
├── docker-compose.yml
├── FITME_PROJECT.md        Architecture & design doc
└── README.md
```

---

## License

This repo is yours. Do what you want with it.
