# CLAUDE.md — Pasada

Build guide for Claude Code. Read this first, every session. Full detail lives in `docs/TECHNICAL_SPEC.md`. Visual source of truth is the Figma exports in `design/`.

---

## What we're building

**Pasada** — a demand-first jeepney coordination platform for SparkFest 2026 (GDG PUP, SDG 11). Tagline: *"Know when to ride. Know when to leave."*

Passengers broadcast that they're waiting; drivers and a cooperative/admin dashboard see live demand, occupancy, and ETAs. Three roles: **Driver**, **Passenger**, **Admin** (the cooperative dispatcher).

**Submission deadline: July 2, 2026. Today is ~Day 2 of 4. Scope ruthlessly.**

---

## Demo context — this drives every decision

The demo is **recorded on three real devices**: two phones (one Driver, one Passenger) and a laptop (Admin). All three hit the **same deployed URL** and sync live through **Firestore listeners**.

Consequences:

- **Driver and Passenger are mobile-first** (single-column, bottom tab bar, ~390px). **Admin is desktop** (wide, top/side tabs).
- The jeep's movement on the map is driven by a **simulation engine** (see spec §8), not real GPS — reliable and reproducible for a recording. Occupancy is still updated *manually* on the Driver phone so the "Update Occupancy" flow is demoed live.
- Protect the **golden thread** (below) above all else. Everything else is secondary.

### Golden thread (the demo that must work)

1. Passenger phone taps **"I'm waiting"** at a stop → demand +1.
2. Admin **Live Operations** + **Passenger Demand** update in real time; Driver sees demand rise.
3. Driver taps **Update Occupancy → 100%** → Passenger's seats flip **12/18 → Full**; Admin flips that unit **red**.
4. Driver **Departure Confidence Score** recalculates from the new demand (Gemini). Driver taps **Start Trip** → jeep animates along the route; Passenger ETA counts down.

If a feature doesn't serve this thread, it's lower priority.

---

## Stack (already chosen — do NOT swap)

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind | `frontend/`, dev on `:3000` |
| Maps | Google Maps Platform via `@react-google-maps/api` | Maps JS, Directions, Distance Matrix. **Not Leaflet.** |
| Realtime DB | Firebase Firestore listeners | shared state across all devices |
| Auth | Firebase Auth — **anonymous** for the demo | see Decision 2 |
| Backend | FastAPI (Python) | `backend/`, dev on `:8000`, proxied via `/api` |
| AI | Gemini (`gemini-1.5-flash`) | Departure Confidence Score + dispatch insight |
| Hosting | Firebase Hosting (web) + Cloud Run (API) | |

Brand colors are already in `frontend/tailwind.config.js`: `brand.red #D32F2F`, `brand.orange #F57C00`, `brand.green #388E3C`, `brand.dark #1A1A2E`. Icons: `lucide-react`. Confirm exact tokens against `design/` PNGs before styling.

---

## Build on the existing repo — do not rescaffold

The repo is a working scaffold (~1,000 lines FE / ~530 BE) with real Firestore listeners (`useFirestore.useCollection`), `useGPS`, `services/api.js`, Google Maps, and auth context already wired. Many `// TODO`s mark the gaps. **Extend these files; don't recreate them.**

```
frontend/src/
  pages/        RoleSelect (was LoginPage) · DriverPage · PassengerPage · AdminDashboard (was CoopDashboard)
  components/   driver/ · passenger/ · cooperative/(admin) · shared/
  hooks/        useAuth · useFirestore · useGPS
  services/     firebase.js · api.js · maps.js   (+ add sim.js)
  context/      AuthContext (holds role)
backend/app/
  routes/       auth · passengers · drivers · demand · ai · confidence
  services/     firebase_service · gemini_service · maps_service · confidence_score
  models/       pydantic schemas
```

---

## Information architecture (from Figma — the redesign)

The Figma replaces login-by-role with a **Role Selector** and adds tabbed navigation. Build to this IA, not the old README structure.

- **Role Selector** → Driver | Passenger | Admin.
- **Driver** — tabs: **Home** · Earnings · Profile(stub).
  Home = map, live occupancy, speed (km/h), current stop, **Start/End Trip**, **Update Occupancy** (modal: quick levels 25/50/70/100 **and** a −/＋ exact-count stepper). Keep a compact **demand** indicator + **Departure Confidence** card on Home (Decision 1).
- **Passenger** — tabs: **Home** · Map · Profile(stub).
  Home = "Where are you going?" search; next-jeep card with ETA progress bar + minutes, route (e.g. *Lumban → Sta. Cruz*), seats `X/18`, plate `ABC1234`, and **"I'm waiting"** → splits into **Cancel** + **Jeepney Details** (detail sheet). Map tab = route search, fare, popular destinations.
- **Admin** — 7 tabs. Build **3 deep**: **Live Operations**, **Passenger Demand**, **Analytics**. **Dashboard** = thin KPI summary reusing existing cards. **Stub** (static, presentable): Fleet Management, Driver Roster, Routes.

---

## Decisions already made (override only with reason)

1. **Keep the Departure Confidence Score + Gemini + demand-first framing.** The Figma IA omits it, but it's the PRD's killer feature and the AI hook a GDG hackathon rewards. Fold it into Driver Home and Admin Analytics rather than cutting it. Without it, Pasada is "just a bus tracker."
2. **Role Selector uses Firebase anonymous auth under the hood.** Selecting a role signs in anonymously (gives a `uid` so existing Firestore rules that require `request.auth != null` keep working) and sets `role` in `AuthContext`. No Google login friction on stage. Repurpose `LoginPage` → `RoleSelect`; `ProtectedRoute` checks `role` from context.
3. **Simulation engine drives jeep movement** for the recording (spec §8). Real `useGPS` stays available but is not the demo default.
4. **One route, one+ jeep for the demo.** Seed the Figma route (*Lumban → Sta. Cruz*, Town Plaza stop). Keep sample data consistent across all three views.

---

## Conventions

- **Firestore is the shared source of truth.** Components never hold authoritative jeep/demand state locally — they read via `useCollection` and write via `services/api.js` (→ FastAPI) or direct owner-doc writes where rules allow.
- **Occupancy:** `occupancyCount` is authoritative; `occupancyPercent = round(count/capacity*100)`; quick buttons set `count = round(capacity * level)`. Passenger **seats available = capacity − occupancyCount** (`0` ⇒ show **Full**).
- **ETA:** compute from the jeep's live position to the passenger's stop (Distance Matrix/Directions); progress bar = `1 − remainingETA/etaAtStart`. Keep consistent with the synced position.
- **Mobile-first** for Driver/Passenger (wrap in a phone-width container + bottom `TabBar`); **desktop** for Admin.
- TypeScript is not set up; match the existing `.jsx` style. Keep shared shapes documented in the spec's data model.
- Don't commit secrets. Keys live in `frontend/.env` and `backend/.env` (see `.env.example`).

---

## Build order (fits the deadline)

1. **Role Selector + anon auth + tab shells** for all three roles (routing + `AuthContext.role`).
2. **Data model + seed script** (`drivers`, `passengers`, `routes`, `stops`) for the demo route. Open Firestore rules to anon during the demo.
3. **Driver Home** — map, occupancy widget (levels + stepper), speed, current stop, Start/End Trip → writes to Firestore.
4. **Passenger Home** — next-jeep card, seats, plate, "I'm waiting" → Cancel/Details; writes a waiting doc.
5. **Admin Live Operations** — all units + demand on the map, reading live.
6. **Simulation engine** (`services/sim.js` + optional seed loop) — animate the jeep on Start Trip.
7. **Passenger Demand** + **Analytics** tabs; wire **Departure Confidence Score** (Gemini) on Driver Home.
8. **Driver Earnings**, Admin **Dashboard** summary, stub tabs, then **polish to match `design/` + deploy**.

Verify the golden thread end-to-end after step 6, then again after deploy.

---

## Commands

```bash
# Frontend
cd frontend && npm install && cp .env.example .env && npm run dev   # :3000

# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt && cp .env.example .env
uvicorn app.main:app --reload --port 8000                            # :8000

# Firebase
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only hosting        # after: cd frontend && npm run build
```

## Don't

- Don't swap the stack (no Leaflet/Supabase/Next) — it's committed.
- Don't rescaffold existing files; extend them.
- Don't drop Gemini/Departure Confidence to "save time" — it's the differentiator.
- Don't build all 7 admin tabs deep; 3 deep + stubs.
- Don't block the demo on real GPS or live login — use the sim engine and anon auth.
