# Phase 5 Production Readiness — Security, Reliability & Testing

## Summary

- **closes #198** — Playwright E2E test suite for wallet connection and onboarding
- **closes #204** — Chain re-organization detection and database rollback in the indexer
- **closes #205** — Redis TTL caching middleware for heavy indexer endpoints
- **closes #206** — Express rate-limiting middleware (100 req/min per IP)

## Changes

### #198 · Frontend · Playwright E2E tests for wallet connection
- Added `playwright.config.ts` with Chromium project and `webServer` config pointing at the Next.js dev server.
- Created `e2e/wallet.spec.ts` covering:
  - Modal opens and closes (close button + backdrop click)
  - Security disclaimer text is present
  - **NOT_INSTALLED state** — "Freighter Not Found" UI and Install link appear when the extension is absent
  - **WRONG_NETWORK state** — wrong network banner and "Refresh Connection" button appear after connecting with the wrong passphrase
  - **CONNECTED state** — success screen, public key display, and auto-close behavior
  - Navbar "Connect Wallet" button disappears after successful connection
  - Hero "Get Started" CTA triggers the connect flow
  - Onboarding "How it Works" section shows "Connect Wallet" as step 1
- Added `e2e/helpers/freighter-mock.ts` with `injectConnectedWallet()` which uses `page.addInitScript` to inject `window.freighter` / `window.stellar` stubs before app scripts run — no real browser extension needed.
- Added `test:e2e` and `test:e2e:ui` scripts to `package.json`.

### #204 · Indexer · Chain re-org detection and DB rollback
- Added `lastLedgerHash String?` column to the `SyncState` Prisma model.
- Exported **`revertLedgers(safeAtLedger: number)`** from `poller.ts`:
  - Runs inside a single `$transaction`:
    1. Deletes `MarketplaceEvent` rows with `ledgerSequence > safeAtLedger`
    2. Deletes `Listing` rows with `createdAtLedger > safeAtLedger`
    3. Resets `updatedAtLedger` and `status` back to `Active` for listings modified past the checkpoint
    4. Deletes `Collection` rows with `deployedAtLedger > safeAtLedger`
    5. Rewinds `SyncState.lastLedger` to `safeAtLedger` and clears `lastLedgerHash`
- `startPolling` now checks `response.latestLedger < syncState.lastLedger` on every poll; if true, `revertLedgers` is called and the loop continues from the new cursor.
- Added 6 focused Vitest tests for `revertLedgers` (all pass, 61 total green).

### #205 · Indexer · Redis TTL caching for heavy endpoints
- Installed `ioredis`.
- Added `src/redis.ts` — a singleton Redis client with graceful degradation on connection failure.
- Introduced a `getCached<T>(key, ttl, fetcher)` helper in `routes.ts` that reads from Redis, falls back to the DB on a miss, and writes results back with `EX` TTL.
- Applied caching to:
  - `GET /activity/recent` — cache key `activity:recent`
  - `GET /collections` — cache key `collections:<kind>:<creator>`
- TTL defaults to 30 s, configurable via `REDIS_CACHE_TTL_SECONDS`.
- Added `REDIS_URL` and `REDIS_CACHE_TTL_SECONDS` to `.env`.

### #206 · Indexer · API rate-limiting middleware
- Installed `express-rate-limit`.
- Applied a global limiter in `src/index.ts`: **100 requests per minute per IP**, using `draft-8` standard headers.
- Returns `{ error: "Too many requests, please try again after a minute." }` on 429.

## Test plan

- [ ] `cd indexer && npm test` — all 61 Vitest tests pass
- [ ] `cd frontend/afristore-app && npm test` — Jest unit tests pass
- [ ] `cd frontend/afristore-app && npm run test:e2e` — Playwright suite runs against a local Next.js dev server
- [ ] Start a local Redis instance (`docker compose up -d`) and hit `/activity/recent` twice — second response should be served from cache (check `x-cache` or Redis `KEYS *`)
- [ ] Curl the indexer rapidly (`for i in $(seq 1 110); do curl -s localhost:4000/health; done`) — 101st request should return HTTP 429
- [ ] Simulate re-org: manually set `SyncState.lastLedger` higher than the RPC node's ledger — next poll should log `[Reorg]` and roll back
