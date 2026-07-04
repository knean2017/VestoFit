# FitMe / VestoFit — Product Analysis (2026-07-04)

Analysis from the perspective of a business owner and four user personas. Each finding maps to one of four implementation plans, ordered by business impact.

## Personas used

1. **Leyla, 24, Baku — casual Gen-Z user.** Wants instant wow on her phone. Won't upload 20 photos before seeing value. Local shopping matters (now served by grounded fallback).
2. **Mark, 34, NYC — paying power user.** Uses try-on heavily, expects the plan he pays for to work and be clearly better than free.
3. **Ayan, 29 — returning user who forgot her password.** If she can't get back in, she's gone; there is no support team.
4. **The owner.** Every FAL render costs real money; Gemini free tier is capped. Needs unit economics to not bleed and needs to know when the product is broken.

## What is good (keep, don't touch)

- Unified conversational stylist with memory + actions (just shipped) — genuine differentiator.
- Three-tier shopping with grounded local fallback — serves markets Google Shopping ignores (AZ etc.).
- Wardrobe auto-tagging pipeline and try-on studio work end-to-end.
- Distinctive immersive UI (closet doors, mirror reveal) with reduced-motion fallbacks.
- Billing rails exist (LemonSqueezy checkout, webhook, subscription status).

## What is bad / risky (ordered by severity)

| # | Finding | Evidence | Persona hit | Plan |
|---|---------|----------|-------------|------|
| 1 | **Pricing promises are not enforced.** Free tier says "5 try-on renders / month"; no quota tracking or gating exists anywhere in the backend. Every anonymous signup gets unlimited FAL renders — direct COGS leak, and paying gives Mark nothing that free doesn't already have. | `grep quota/renders_used` → zero hits in `backend/app`; tryon router has no plan check | Owner, Mark | 1 |
| 2 | **No password reset.** Only `/auth/register`, `/auth/login`, `/auth/me`. A forgotten password permanently locks the account. No email infrastructure at all. | `backend/app/routers/auth.py` | Ayan | 2 |
| 3 | **Cold first run.** After signup: empty wardrobe, empty studio, generic chat greeting. Value requires avatar upload + several garment photos before anything impressive happens. No checklist, no progress, no demo content. | onboard flow ends at avatar upload; wardrobe/studio have no guided empty states | Leyla | 3 |
| 4 | **Failures are invisible.** LLM 429/503 shows "trouble thinking" with no operator trace; no `/health` for deploy checks; FAL/Gemini errors are swallowed (`except: pass` style) with no structured logs. Owner cannot tell outage from quota from bug. | `llm_service`, `tryon_service` error paths; no health route in `main.py` | Owner, all | 4 |

## What is complex / should be simplified (noted, not planned)

- Three legacy stylist endpoints (`/suggest`, `/reroll`, `/ask`) still alive next to `/stylist/chat` — consolidate after `/chat` is proven in production (deliberate scope cut from the unified-stylist plan).
- `.playwright-mcp/` snapshot files and stale screenshots are committed at repo root — repo hygiene, batch cleanup later.
- Mobile Expo app duplicates web flows; keep investing only after web activation metrics justify it.

## What should be added later (backlog, no plan yet)

- Email verification at signup (anti-abuse; Plan 2 lays the email foundation for it).
- i18n (AZ/RU/TR) — the grounded-shopping work targets those markets; UI is English-only.
- Outfit calendar / "what I wore" history; social sharing of rendered looks.
- Grounded-search result caching when Gemini quota pressure appears (noted in shopping plan).

## The four plans (execute in order)

1. `2026-07-04-plan-quotas-monetization.md` — track render usage, enforce plan limits, expose usage API, show meter + upgrade CTA.
2. `2026-07-04-account-recovery.md` — pluggable email service + forgot/reset password flow, web pages included.
3. `2026-07-04-first-run-activation.md` — activation checklist on home, guided empty states, new-user stylist greeting chips.
4. `2026-07-04-reliability-observability.md` — `/health`, structured LLM/FAL failure logging, honest "busy" messaging with retry hint.
