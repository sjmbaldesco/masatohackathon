# Pasada — Technical Specification

**Version:** 1.0 (Figma reconciliation) · **For:** Claude Code in VS Code · **Deadline:** July 2, 2026
**Companion docs:** `CLAUDE.md` (build guide), `PASADA_PRD.md` (product rationale), `design/` (Figma PNGs = visual source of truth).

This spec defines *behavior, data, and architecture*. The `design/` PNGs define *look*. When they conflict on layout, follow the PNGs and keep the data flow below.

---

## 1. Purpose & the reconciliation problem

The existing repo (PRD + scaffold) and the new Figma describe the **same platform with different information architecture**. The Figma is a UI redesign; the backend, data model, and real-time plumbing are largely reusable. This spec merges them so the redesign doesn't strip the differentiators that win the hackathon.

| Aspect | Existing repo / PRD | New Figma | Resolution |
|---|---|---|---|
| Entry | Google login + role-gated routes | **Role Selector** | Role Selector → anonymous auth, sets `role` (Decision 2) |
| Driver | One dashboard: demand heatmap, queue, confidence score | **Home / Earnings / Profile** tabs; occupancy + speed + stop + trip | Tabbed Home, occupancy-first, **keep** a demand + confidence card (Decision 1) |
| Passenger | RouteSelector, WaitingButton, ETACard | **Home / Map / Profile** tabs; search, ETA bar, seats, plate, Jeepney Details | Adopt Figma; "I'm waiting" still writes a demand doc |
| Admin | "Cooperative Dashboard": KPIs, route overview, AI insights | **7 tabs** | 3 deep (Live Ops, Passenger Demand, Analytics) + thin Dashboard + 3 stubs |
| Killer feature | Departure Confidence Score (Gemini) | *(absent)* | **Keep** — fold into Driver Home + Analytics |

### Decisions (locked unless overridden)

1. **Keep Gemini + Departure Confidence Score + demand-first framing.** It's the AI hook and the differentiator. Cutting it makes Pasada a generic tracker.
2. **Role Selector = Firebase anonymous auth** behind the scenes, so existing Firestore rules (`request.auth != null`) keep working with zero login friction.
3. **Simulation engine** drives jeep movement for the recorded demo; occupancy is updated manually on the Driver phone.
4. **One demo route, ≥1 jeep.** Seed *Lumban → Sta. Cruz* with a Town Plaza checkpoint; keep sample data identical across roles.

---

## 2. Demo setup & constraints

- **Recorded**, three devices on one deployed URL: **two phones** (Driver, Passenger) + **laptop** (Admin), synced via Firestore.
- Driver/Passenger = **mobile-first** (~390px, bottom tab bar). Admin = **desktop** (wide, top/side tabs).
- For the recording, the jeep moves via the **sim engine**, not real GPS. This removes the biggest live-demo risk.
- Everything is built to protect the **golden thread** (§9).

---

## 3. Architecture & data flow

```
 Driver phone        Passenger phone          Admin laptop
 (occupancy,         ("I'm waiting",          (read-only views +
  Start/End Trip)     ETA, details)            Gemini insight)
      │                    │                        │
      └──── writes ───┐    └──── writes ───┐        │ reads
                      ▼                    ▼        ▼
                 ┌─────────────────────────────────────┐
                 │     Firestore  (shared truth)        │
                 │  drivers · passengers · stops ·      │
                 │  routes · trips · earnings           │
                 └─────────────────────────────────────┘
                      ▲            ▲              ▲
        real-time listeners   Admin SDK writes   Distance Matrix / Directions
                      │       (FastAPI backend)        (ETA, polyline)
                 ┌────┴───────────────┐
                 │  FastAPI (Cloud Run)│  ── Gemini ──► Departure Confidence,
                 │  confidence · ai ·  │                dispatch insight
                 │  demand · drivers   │
                 └─────────────────────┘
                      ▲
                 Simulation engine (frontend sim.js or seed loop)
                 writes jeep lat/lng/speed on a timer
```

- **Reads** are Firestore real-time listeners (`useCollection`) on every device — this is what makes cross-role reactivity instant.
- **Writes:** owner docs (a passenger's own waiting doc, a driver's own occupancy/GPS) may write directly under existing rules; aggregates (`stops` demand counts, `routes`) are written by the **backend** via Admin SDK. Gemini/ETA calls go through FastAPI.

---

## 4. Tech stack (authoritative)

React 18 + Vite + Tailwind · `@react-google-maps/api` (Maps JS, Directions, Distance Matrix) · Firebase Firestore + Auth (anonymous) + Cloud Messaging (optional) · FastAPI + `firebase-admin` + `google-generativeai` + `googlemaps` · Gemini `gemini-1.5-flash` · Firebase Hosting + Cloud Run. Do not substitute (no Leaflet/Supabase/Next).

---

## 5. Data model (Firestore)

Field names follow the existing scaffold (`snake_case`, existing indexes in `firestore.indexes.json`). Derived values are computed client-side unless noted.

### `routes/{routeId}`
```jsonc
{
  "route_id": "R01",
  "name": "Lumban → Sta. Cruz",
  "origin": "Lumban",
  "destination": "Sta. Cruz",
  "fare_base": 13,                 // PHP
  "stops": ["Lumban", "Town Plaza", "Pagsawitan", "Sta. Cruz"],
  "polyline": [[14.30,121.46], ...], // Directions-decoded path for the map + sim
  "active_drivers": 1,
  "total_waiting": 0
}
```

### `drivers/{uid}`  — one live jeep
```jsonc
{
  "uid": "anon-or-seed-id",
  "driver_name": "J. Dela Cruz",
  "plate": "ABC1234",
  "route": "R01",
  "capacity": 18,
  "occupancy_count": 9,            // AUTHORITATIVE
  "occupancy_pct": 50,             // = round(count/capacity*100)
  "speed_kmh": 24,
  "lat": 14.30, "lng": 121.46,
  "current_stop": "Town Plaza",
  "status": "idle",                // idle | in_transit | ended
  "last_updated": "<serverTimestamp>"
}
```
Rules: quick levels set `occupancy_count = round(capacity * {0.25,0.5,0.7,1.0})`; stepper sets it exactly. **seats_available = capacity − occupancy_count** (`0` ⇒ "Full").

### `passengers/{uid}` — a waiting broadcast
```jsonc
{
  "uid": "...", "route": "R01", "stop": "Town Plaza",
  "lat": 14.30, "lng": 121.46,
  "status": "waiting",             // waiting | cancelled | boarded
  "timestamp": "<serverTimestamp>"
}
```

### `stops/{stopId}` — aggregated demand (backend-written)
```jsonc
{ "stop_id": "town-plaza", "route": "R01", "name": "Town Plaza", "lat": 14.30, "lng": 121.46, "count": 3 }
```

### `trips/{tripId}` — for earnings (created on Start/End Trip)
```jsonc
{ "trip_id": "...", "driver_uid": "...", "route": "R01",
  "started_at": "...", "ended_at": null,
  "passengers_boarded": 0, "fare_collected": 0 }
```

### `earnings/{uid}/days/{date}` — aggregated for the Earnings tab
```jsonc
{ "date": "2026-06-29", "trips": 4, "passengers": 63, "gross": 1180 }
```

---

## 6. Real-time sync — who reads/writes what

| Collection | Driver | Passenger | Admin | Writer |
|---|---|---|---|---|
| `drivers` | write own | read (route) | read all | driver / sim |
| `passengers` | read aggregate | write own | read all | passenger |
| `stops` (demand) | read (route) | read | read all | backend |
| `routes` | read | read | read/manage | backend/seed |
| `trips`,`earnings` | write own / read | — | read all | driver / backend |

The cross-role "wow" comes entirely from listeners: a driver write to `drivers/{uid}.occupancy_count` propagates to the Passenger card and Admin Live Ops within Firestore's push latency — no manual refresh.

---

## 7. Departure Confidence Score (keep this)

Backend endpoint `POST /confidence` (already stubbed in `routes/confidence.py` + `services/confidence_score.py`). Inputs: waiting count along route (`stops`), capacity vs current occupancy, time-of-day boarding prior, current traffic (Directions). Gemini (`services/gemini_service.py`) phrases the recommendation.

Output shape:
```json
{ "confidence": 92, "expected_passengers": "17–18",
  "expected_travel_min": 41, "expected_revenue": 320,
  "recommendation": "Depart now", "reason": "High demand at Town Plaza; light traffic." }
```
Render as a card on **Driver Home** and surface the same call in **Admin → Analytics** as a dispatch insight. For demo safety, have the backend return a deterministic fallback if Gemini latency/quota fails.

---

## 8. Simulation engine (demo movement)

Goal: a believable moving jeep without driving one, reproducible for the recording.

- `frontend/src/services/sim.js`: given a route `polyline` and a speed, interpolate position along the path on a timer (e.g. 1s tick) and write `lat/lng/speed_kmh/current_stop` to that driver's Firestore doc. Advance `current_stop` when passing a stop's coordinates.
- Trigger on Driver **Start Trip** (`status: in_transit`); stop and set `status: ended` on **End Trip**.
- Keep **occupancy manual** (the "Update Occupancy" flow is part of the demo). Optionally auto-decrement `stops.count` for the stop the jeep passes (demand "served").
- Provide a tiny **seed script** (`backend` or a `scripts/seed.mjs`) to create the route, one driver, and 2–3 waiting passengers so no screen is empty before the live passenger taps "I'm waiting".
- Real `useGPS` remains wired as an alternate source; sim is the default for recording.

---

## 9. Golden thread (must-work demo path)

1. Passenger taps **"I'm waiting"** at Town Plaza → `passengers` doc + `stops.count++`.
2. Admin **Live Operations** dot/heat at Town Plaza rises; **Passenger Demand** list updates; Driver Home demand chip updates.
3. Driver **Update Occupancy → 100%** → Passenger card seats `12/18 → Full`; Admin unit badge → **red**.
4. **Departure Confidence** recomputes (Gemini) → "Depart now 92%". Driver **Start Trip** → sim animates jeep; Passenger **ETA** progress bar counts down; on arrival, demand at that stop clears.

Test this end-to-end after the sim engine lands, and again after deploy.

---

## 10. Role: Role Selector

Full-screen choice (Driver / Passenger / Admin) per `design/`. On select: `signInAnonymously()`, set `role` in `AuthContext`, route to the role's tab shell. Repurpose existing `LoginPage` → `RoleSelect`; `ProtectedRoute` checks `role`. Add a small "demo: switch role" affordance for testing on a single screen.

---

## 11. Role: Driver (mobile)

Bottom tabs: **Home · Earnings · Profile**.

**Home**
- **Map** (Google Map) centered on the jeep; marker follows `drivers/{uid}` position.
- **Status strip:** current occupancy (`9/18 · 50%`), **speed** (`24 km/h`), **current stop** (`Town Plaza`).
- **Demand chip / mini-list** for the route (from `stops`) — keeps the demand-first thesis visible.
- **Departure Confidence card** (§7).
- **Start/End Trip** button — toggles `status`, starts/stops the sim, opens/closes a `trip`.
- **Update Occupancy** button → **modal**:
  - Quick levels: **25% · 50% · 70% · 100%** (set `occupancy_count = round(capacity*level)`).
  - Exact stepper: `[ − ]  N  [ ＋ ]` bound to `occupancy_count` (clamp 0…capacity).
  - Save writes `occupancy_count` + recomputed `occupancy_pct`.

**Earnings** — simple, comprehensive report from `earnings`: today's gross (₱), trips, passengers, a small bar/line trend (last 7 days), and per-trip rows. Static seed data acceptable if `trips` aren't fully wired.

**Profile** — non-responsive stub (avatar, name, plate, route, settings list) per Figma.

---

## 12. Role: Passenger (mobile)

Bottom tabs: **Home · Map · Profile**.

**Home**
- **Search bar** on top: *"Where are you going?"* (destination → sets route/stop).
- **Map** preview.
- **Next-jeep card:**
  - **ETA**: progress bar + minutes (e.g. `3 mins`), computed from the jeep's live position to the passenger's stop (§ETA rule).
  - **Route**: `Lumban → Sta. Cruz`.
  - **Seats available**: `12/18` (from `capacity − occupancy_count`; `0` ⇒ **Full**).
  - **Plate**: `ABC1234`.
  - **"I'm waiting"** primary button → on tap writes a `passengers` waiting doc + increments demand, and **splits into two**: **Cancel** (sets `cancelled`) and **Jeepney Details**.
- **Jeepney Details** (sheet/modal): fuller occupancy view (count, %, seats, capacity bar), plate, driver name, speed, current stop, live ETA, route progress. Read-only.

**Map tab** — search routes; show **fare** (from `route.fare_base` + distance) and **popular destinations** (static list acceptable).

**Profile** — non-responsive stub.

---

## 13. Role: Admin (desktop) — 3 deep + thin Dashboard + 3 stubs

Top/side tabs: Dashboard · Live Operations · Fleet Management · Driver Roster · Routes · Passenger Demand · Analytics.

**Live Operations (deep)** — big Google Map with all active units (color by occupancy: green/orange/red), demand intensity per stop from `stops`, and a side list of units (plate, route, occupancy, speed, status). Reads live. This is the admin "wow".

**Passenger Demand (deep)** — per-stop waiting counts (the heatmap/queue), aggregated from passenger broadcasts; sortable by route/stop; shows the live total. Closes the loop with the Passenger "I'm waiting" action. Reuses `RouteOverview`/`KPICards` patterns.

**Analytics (deep)** — KPIs: avg wait, avg occupancy, revenue/unit, total waiting; trend charts (peak hours, busiest stops); a **Gemini dispatch insight** panel ("Why is demand low?" → natural-language answer) reusing `AIInsights`.

**Dashboard (thin)** — landing summary: 3–4 KPI cards + a mini Live-Ops map. Reuse components; no new data.

**Stubs (presentable, static):** Fleet Management (unit table), Driver Roster (driver table), Routes (route list + fares). Real tables with seed rows so they don't look empty; no live wiring required.

> Rationale for the deep three: Live Ops shows real-time supply, Passenger Demand shows the differentiating signal, Analytics shows business value + AI. Swap one only if a judge specifically expects Fleet/Roster depth.

---

## 14. Maps & ETA

- One `LoadScript`/`useJsApiLoader` at app root with libraries `["places"]` (+ geometry if needed). Reuse `services/maps.js` (`MAPS_API_KEY`, `LIBRARIES`, `DEFAULT_CENTER`).
- Route **polyline** from Directions API, cached on the `routes` doc and reused by the sim engine + all maps.
- **ETA** via Distance Matrix from jeep position → passenger stop; progress bar `= 1 − remainingETA/etaAtStart`. Cache to avoid quota burn; fall back to distance/`speed_kmh` if the API errors.

---

## 15. Visual design

Source of truth = `design/` PNGs. Until tokens are extracted from them, use the existing Tailwind `brand` palette (`red #D32F2F`, `orange #F57C00`, `green #388E3C`, `dark #1A1A2E`) and `lucide-react`. Occupancy color scale: ≤50% green, 51–85% orange, >85%/Full red — apply consistently to the Passenger seats badge, Driver status, and Admin map markers. Mobile views: max-width phone container + fixed bottom `TabBar`. Admin: responsive grid, sticky tab nav.

---

## 16. Build order & 3-day plan

**June 29 (Day 2):** Role Selector + anon auth + tab shells (all roles); data model + `seed` script; Driver Home (map, occupancy modal, speed, stop, Start/End Trip).
**June 30 (Day 3):** Passenger Home (next-jeep card, "I'm waiting" → Cancel/Details); Admin Live Operations; **simulation engine**; verify golden thread.
**July 1 (Day 4):** Passenger Demand + Analytics + Departure Confidence (Gemini); Driver Earnings; Admin Dashboard summary + stub tabs; polish to `design/`; deploy (Hosting + Cloud Run); rehearse + record.
**July 2:** buffer + submit.

---

## 17. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Live multi-device sync flakes during recording | It's recorded — re-take; sim engine is deterministic; anon auth removes login failure |
| Gemini latency/quota | Deterministic fallback in `confidence_score.py`; cache last good result |
| Google Maps quota/billing | Cache polyline + ETA; one API loader; restrict key |
| 7 admin tabs eat the timeline | 3 deep + stubs (§13) |
| Scope creep (FCM push, real GPS) | Out of scope for the recording; sim + in-app banner instead |

---

## 18. Out of scope (for the demo)

Real Google login, Cloud Messaging push, real driver GPS, payments/booking, multi-route fleets, historical ML. Keep the anonymous, single-route, simulated-movement path.
