# VTO (Virtual Try-On) — VestoFit

Fashion-tech app: AI stylist chat, virtual wardrobe, try-on studio, shopping.

**Production surface: the Expo app in `mobile/` only.** The Next.js web app (`frontend/`)
is a dev/demo surface — never ships to production; do not build new features on it.

## Stack
- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS
- Backend: FastAPI (Python), Docker
- Animation: GSAP, Framer Motion, React Three Fiber, Lenis smooth scroll
- AI: Anthropic Claude API for stylist chat

## Run
- Frontend: `cd frontend && npm run dev` (port 3000)
- Backend: `cd backend && uvicorn app.main:app --reload` (port 8000)
- Docker: `docker compose up`
