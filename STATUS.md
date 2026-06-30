# Pasada — Status & Schedule

_Updated 2026-06-30 (Day 2 of final stretch) · Deadline **Thu Jul 2** · Branch `main` @ a9de44b_

## Verdict

The demo build is **real, on `main`, and now pulled into this folder.** The golden thread is built end-to-end in code (~4,600 FE lines, full backend). Remaining work is **deploy + demo prep, not feature-building.** Single biggest risk: **nothing is deployed yet**, and the 3-device recorded demo needs one shared live URL.

> This folder was previously a stale scaffold (~1,000 lines, no git). It now tracks `github.com/sjmbaldesco/masatohackathon`. Local-only docs (`CLAUDE.md`, `*_PROMPT.md`, the 2 PDFs, `docs/TECHNICAL_SPEC.md`) were preserved as untracked files.

## Verified built (against actual code)

- **Role Selector + auth** — email/password (passenger/admin) + Google + driver ID/PIN. _(PIN is a UX stub, not server-verified.)_
- **Passenger** — "I'm waiting" toggle (writes `passengers/{uid}`), ETA card, demand, map, tab bar.
- **Driver** — Google map w/ smooth follow, Occupancy modal (quick levels + −/＋ stepper), Start/End Trip, `sim.js` jeep animation, Departure Score (Gemini + heuristic fallback).
- **Admin** — Live Operations, Passenger Demand, Analytics built deep; Excel export wired (`xlsx`).
- **Infra** — ErrorBoundary, real-time Firestore listeners, warm map style, seed scripts, backend `Dockerfile`, hosting config, auth-gated Firestore rules.

## Golden thread — built; verify live

1. Passenger "I'm waiting" → demand **✔** writes `passengers/{uid}`
2. Admin/Driver see demand live **✔ — verify:** driver demand reads the `stops` collection, which is **backend-write-only** (`allow write: if false`). Demand only flows if the deployed backend aggregates `passengers → stops`. **If the API isn't deployed, demand won't update.**
3. Occupancy 100% → Passenger "Full" / Admin red **✔**
4. Departure Score recalc + Start Trip animation + Passenger ETA **✔** _(`travel_time_min` hardcoded to 35)_

## Blocking the demo (must do)

- **B1 — Deploy.** No `.firebaserc`; FE `VITE_API_BASE_URL=http://localhost:8000`; backend not on Cloud Run. **Critical path.**
- **B2 — Secrets/env on the deploy target.** Real `.env` is gitignored: Firebase web config, `VITE_GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY`, backend service-account JSON.
- ~~**B3 — Enable Google Maps billing**~~ — ✅ **Done.** Watermark is gone; billing is active on `pasada-0127` (so the project is on Blaze → Firestore daily free-tier overage just bills, no hard stop).
- **B4 — Seed the deployed Firestore** — `seed_route.py`, `seed_stops.py`, `seed_demo.py`, `create_demo_accounts.py`.
- **B5 — Verify the golden thread on the live URL across all 3 devices** (esp. the demand path in #2 above).

## Polish / non-blocking (CLAUDE.md: don't block the demo on these)

ORS travel time (un-hardcode 35) · driver PIN server validation · `google-generativeai 0.7.2` deprecation warning · TRIPS/EARNINGS still mock data · wire `DemandHeatmap`/`QueueStatus` into DriverPage · `ActiveTripMap` (Leaflet) unused · make stub admin tabs (Fleet / Roster / Routes) presentable.

## Updated schedule

**Tue Jun 30 (today) — Deploy + Data**
- Create FE + BE `.env` (B2). _(Maps billing / B3 already done.)_
- `cd frontend && npm i && npm run build`; `firebase use --add pasada-0127`; `firebase deploy --only hosting,firestore:rules,firestore:indexes`.
- Containerize backend → Cloud Run; set `VITE_API_BASE_URL` to the Cloud Run URL and `ALLOWED_ORIGINS` to the hosting domain; rebuild + redeploy FE (B1).
- Run seed scripts against deployed Firestore; smoke-test the live URL on desktop (B4).

**Wed Jul 1 — Harden + rehearse**
- Golden-thread dry run on 3 devices against the live URL; fix sync issues. Confirm demand aggregation (`passengers → stops`) works live.
- Demo-critical polish: Departure Score visuals, occupancy red-flip timing, ETA countdown, match `design/` PNGs, silence console noise.
- Make stub admin tabs presentable. Record a backup take.

**Thu Jul 2 — Record + submit**
- Final rehearsal → record the official 3-device demo (leave buffer for retakes).
- Assemble submission: repo link, live URL, video, PRD/pitch. **Submit early**, not at the last hour.

## Notes

- Branches on remote: `main`, `Avo-Backend`, `Dian-Frontend`, `Jai-Backend`.
- Git may show many files as "modified" in a Linux/OneDrive context — that's the mount's exec-bit, not real edits; `git status` is clean on Windows.
