# Email Verification, Stylist Cleanup, Grounded-Search Cache — Design (2026-07-06)

Batch of three backlog items from `2026-07-04-product-analysis.md` ("What should be added later"), approved 2026-07-06. Mobile is the only production surface; web (`frontend/`) is dev-only.

## 1. Email verification — soft-gate on renders

**Problem.** Quotas are enforced per account (`quota_service`), but signups are unverified, so one person can farm free FAL renders with disposable accounts. Email infrastructure already exists (`email_service`, console backend in dev).

**Decision (owner-approved).** Soft gate: signup and all flows work unverified, except the three costly render endpoints. No grandfathering — existing accounts start unverified and verify on demand (dev/test accounts read the code from console-logged email).

### Backend

- **Column:** `users.email_verified_at TIMESTAMPTZ NULL`, added in `db_migrate.py` with the existing `IF NOT EXISTS` ALTER pattern. NULL = unverified.
- **Token table:** `email_verification_tokens` (new model, mirrors `password_reset.py`): `id`, `user_id`, `code_hash` (sha256 of a 6-digit numeric code), `expires_at` (24 h), `used_at`. Requesting a new code invalidates prior unused ones, same as reset flow.
- **Service:** `email_verification_service.py` mirroring `password_reset_service.py`:
  - `request_verification(db, user)` — no-op if already verified; otherwise invalidate old tokens, create code, send email. Email body contains the line `Verification code (paste it in the app): {code}` (exact format pinned by test).
  - `verify_email(db, user, code)` — validates hash/expiry/unused, sets `email_verified_at`, burns token. Raises `VerificationCodeError` on bad/expired code.
- **Endpoints (both require auth):**
  - `POST /auth/verify/request` → 202 `{message}`; also called automatically at the end of register (fire-and-forget — registration must not fail if SMTP does).
  - `POST /auth/verify` `{code}` → 200 `{message}` or 400 on bad code.
- **`GET /auth/me`** gains `email_verified: bool` (derived from `email_verified_at`).
- **Gate:** shared `ensure_email_verified(user)` helper used by `/tryon/url`, `/tryon/upload`, `/tryon/outfit`, next to the existing `_check_quota` call. Unverified → **403** with `detail="email_unverified"` (machine-readable; mobile matches on it).
- **Rate limiting:** both new endpoints take `dependencies=[Depends(rate_limit_auth)]`, same as `/auth/forgot` and `/auth/reset`. Enumeration is not a concern (endpoints are auth'd).

### Mobile

- `api.ts`: `email_verified` on `UserMe`; `requestVerification()`, `verifyEmail(code)`.
- New screen `mobile/app/verify-email.tsx` (outside `(auth)` group — user is logged in): 6-digit code input, "Verify" button, "Resend code" link with a resent toast. Success → toast + `router.back()`.
- Entry points:
  1. Settings: row showing "Email verified ✓" or "Verify email →" (navigates to the screen).
  2. Studio: when a render call fails with 403 `email_unverified`, show a toast "Verify your email to render" and navigate to the screen (instead of the generic error toast).
- Unistyles theme tokens throughout; typed-routes regen after adding the screen.

## 2. Retire `POST /stylist/ask`

`/stylist/chat` is proven on web and (since `151fe97`) mobile. Verified zero remaining callers of `stylistAsk` in `mobile/` and `frontend/` outside the api client definitions.

- Delete the `/ask` route from `backend/app/routers/stylist.py`, its service function, and `StylistAskResponse` if nothing else imports it (check `shopping` schemas — `ask_shopping_assistant` is unrelated and stays).
- Delete `stylistAsk` from `mobile/src/lib/api.ts` and `frontend/src/lib/api.ts`.
- Update README endpoint list.
- `/suggest` and `/reroll` stay — mobile's Suggest/Shuffle buttons use them.

## 3. Grounded-search TTL cache

**Problem.** `_search_grounded` and `_search_local_stores` (shopping_service) burn capped Gemini quota; identical queries repeat (chips, retries, shared trending queries).

- In-process cache module-level in `shopping_service.py`: plain dict `{key: (expires_at, results)}` guarded by a lock-free single-threaded asyncio assumption (FastAPI single loop — no threading involved).
- Key: `(fn_name, query.strip().lower(), budget_max, category, country, city)`.
- TTL 12 h; max 200 entries — on insert past cap, evict expired first, then oldest.
- Only successful non-empty results are cached (an empty/error result must retry next call).
- Applied to both `_search_grounded` and `_search_local_stores`. SerpAPI path is not cached (paid tier, fresher-is-better).
- Resets on deploy/restart — accepted; this is a quota shield, not a datastore.

## Testing

- **Backend (pytest, current suite 58):** verification service round-trip (request → code line format → verify sets timestamp → reuse fails → expiry fails), render-gate 403 for unverified / pass for verified (monkeypatch pattern from `test_password_reset_service.py`), cache hit/expiry/no-cache-on-empty via injected clock or monkeypatched time.
- **Mobile (RNTL v14 async API, current suite 31):** verify-email screen renders, submits code, resend fires.
- **Live verification:** register fresh account → render blocked 403 → code from `docker logs` → verify → render passes; `/stylist/ask` returns 404; repeated grounded shop query logs one Gemini call.

## Out of scope

- Grandfathering existing accounts (owner accepted friction).
- Blocking login/signup on verification.
- Deep-link verification (revisit at store submission, same as reset).
- Persistent cache table.
- Removing `/suggest`, `/reroll`, or web frontend code beyond `stylistAsk`.

## Follow-up (separate spec)

Outfit calendar / "what I wore" history — approved as the next feature after this batch; needs its own brainstorm + spec.
