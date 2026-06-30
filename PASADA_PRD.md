# Pasada — Product Requirements Document

> *"Know when to ride. Know when to leave."*

**Version:** 2.0 (updated to reflect built state)
**Hackathon:** SparkFest 2026 — GDG on Campus PUP
**SDG Alignment:** SDG 11 — Sustainable Cities & Communities
**Submission Deadline:** July 2, 2026
**Repo:** https://github.com/sjmbaldesco/masatohackathon

---

## Problem Statement

The Philippine jeepney system operates on a two-sided waiting problem:

- **Passengers** don't know when a jeep will arrive — so they wait blindly at the curb.
- **Drivers** don't know where passengers are — so they wait at terminals until the jeep fills up.

Both sides lose time. Cooperatives have no data to dispatch smarter. The result is inefficient routes, long wait times, and underutilized units — all of which disproportionately affect low-income commuters who depend on jeepneys as their primary mode of transport.

**This is not a technology gap. It is an information gap.**

---

## Solution

Pasada is a demand-first public transport coordination platform. It digitizes the street-level demand that already exists — where passengers are waiting, how many — and surfaces it to drivers and cooperative dispatchers in real time.

- Passengers don't *book* a jeep (no ride-hailing, no legal complications).
- Passengers *broadcast demand* — they signal they are waiting at a stop.
- Drivers see aggregated demand along their route and an AI score on whether to depart now.
- Cooperatives see the full fleet picture and can export analytics with AI narrative.

---

## Users

| User | Role | Primary Need |
|---|---|---|
| Passenger | Demand broadcaster | Signal waiting; see jeep ETA |
| Driver | Supply operator | Know where passengers are; know when to depart |
| Cooperative Admin | Fleet coordinator | See fleet status; export analytics |

---

## Features — Built State (as of July 2026)

### Passenger App ✅

| Feature | Status | Notes |
|---|---|---|
| Select boarding stop on live map | ✅ Built | Stop list from R01 `ROUTE_STOPS`, tap to select |
| Signal waiting (broadcast to Firestore) | ✅ Built | Toggle button — rust "Waiting at {Stop}" when active |
| Signal persists on page refresh | ✅ Built | Restored from Firestore on mount |
| Cancel signal | ✅ Built | Toggle off calls `cancelWaiting` → deletes Firestore doc |
| Live ETA as jeep approaches | ✅ Built | `etaMinutes()` from driver's live position |
| Demand heatmap visible on map | ✅ Built | Concentric CircleF per stop, color-coded by count |
| Own GPS position marker | ✅ Built | SVG stick-figure person marker |
| Recenter button | ✅ Built | Snaps map to GPS position |
| Route polyline on map | ✅ Built | R01 ORS polyline, rust color |
| Push notification on arrival | ❌ Not built | FCM not implemented; out of scope for demo |
| Google login | ❌ Removed | Replaced with email/password for reliability |

### Driver App ✅

| Feature | Status | Notes |
|---|---|---|
| Live demand heatmap | ✅ Built | Two CircleF per stop, density color gradient |
| Animated jeep marker (self) | ✅ Built | 60fps rAF ease-out between 500ms Firestore ticks |
| Departure Confidence Score | ✅ Built | Deterministic base + Gemini ±10 adj, 30s cache, soft-fail |
| Update Occupancy modal | ✅ Built | Bottom-sheet, SVG ring, stepper |
| Start Trip (simulation) | ✅ Built | Haversine sim at 50km/h, 500ms Firestore writes, cycles route |
| Recenter button | ✅ Built | Follows jeep's live position |
| Route polyline on map | ✅ Built | R01 polyline |
| GPS auto-update (real device) | ❌ Stub | `useGPS` hook built but unused; sim replaces GPS for demo |
| Driver earnings / trip history | ❌ Mock | TRIPS and EARNINGS tabs show hardcoded placeholder data |

### Admin Dashboard ✅

| Feature | Status | Notes |
|---|---|---|
| Live Ops: route polyline | ✅ Built | R01 polyline overlay |
| Live Ops: demand heatmap | ✅ Built | Demand grouped by 11m grid, concentric circles |
| Live Ops: per-unit status cards | ✅ Built | Occupancy color-coded, current stop |
| Analytics: fleet KPIs | ✅ Built | Active drivers, total waiting, avg occupancy |
| Export to Excel (4 sheets) | ✅ Built | Summary, Drivers, Demand, AI Insights via SheetJS |
| AI Insights in Excel | ✅ Built | Gemini narrative via `/ai/analytics/insights`, soft-fails to templates |
| Historical analytics | ❌ Not built | Only live snapshot; no time-series storage |

---

## Killer Feature — Departure Confidence Score

Instead of telling a driver to "wait until full," Pasada computes whether departing *now* is optimal.

**Algorithm:**
```
fill_ratio = (on_board + waiting_at_stops) / capacity
base_score = fill_ratio^0.7 × 85  +  idle_bonus (max 15)
gemini_adjustment = bounded [-10, +10]
final_score = clamp(base_score + gemini_adjustment, 0, 100)
```

**Example output:**
```
Departure Confidence        78%

Expected passengers:        13
Travel time:                35 min
Expected revenue:           ₱195

Recommended: Depart Soon
```

**Properties:**
- Deterministic base ensures consistent, explainable scores
- Gemini provides context-aware adjustment (rush hour, fairness, earnings)
- 30-second in-process cache per driver avoids Gemini hammering
- Soft-fails to base score if Gemini times out — never blocks the driver

---

## AI Integration (Gemini)

| Trigger | Output | Status |
|---|---|---|
| Driver views Departure Score | Confidence score + short recommendation | ✅ Live |
| Admin exports Excel | 3 AI Insights paragraphs in workbook | ✅ Live |
| Dispatcher requests route analysis | Natural language dispatch recommendation | ✅ Endpoint built, not wired to UI |
| Passenger asks for tip | ETA + occupancy recommendation | ❌ Stub only |

---

## Tech Stack (Actual)

| Component | Technology |
|---|---|
| Frontend | React 18.3, Vite 5.4, Tailwind CSS v3 |
| Maps | `@react-google-maps/api` v2.20.8 (`PolylineF`, `CircleF`, `OverlayView`) |
| Auth | Firebase Authentication — email/password + synthetic driver email |
| Database | Firebase Firestore — real-time via `onSnapshot` |
| Backend | FastAPI 0.111 + Uvicorn |
| AI | Gemini `gemini-1.5-flash` via `google-generativeai` 0.7.2 |
| Routing | OpenRouteService API (polyline seed) |
| Export | SheetJS `xlsx` v0.18.5 |

---

## Firestore Schema (Actual)

### `drivers/{uid}`
```json
{
  "uid": "string",
  "driver_name": "string",
  "plate": "string",
  "route": "R01",
  "capacity": 18,
  "occupancy_count": 9,
  "occupancy_pct": 50,
  "speed_kmh": 50,
  "lat": 14.114,
  "lng": 121.483,
  "current_stop": "Lumban",
  "status": "in_transit",
  "last_updated": "Timestamp"
}
```

### `passengers/{uid}`
```json
{
  "route": "R01",
  "status": "waiting",
  "lat": 14.114,
  "lng": 121.483,
  "stop": "Lumban"
}
```

### `routes/{id}`
```json
{
  "route_id": "R01",
  "name": "Lumban - Sta. Cruz",
  "polyline": [{"lat": 14.114, "lng": 121.483}, "... 223 points"]
}
```

### `users/{uid}`
```json
{
  "uid": "string",
  "role": "passenger | driver | admin",
  "createdAt": "ISO string"
}
```

---

## System Architecture

```
  Passenger (React)          Driver (React)           Admin (React)
        │                        │                         │
        └────────────────────────┼─────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │           FastAPI Backend            │
              │     (Firebase Admin token verify)    │
              └──────────┬────────────┬─────────────┘
                         │            │
                   Firestore DB    Gemini API
                   (real-time)     (flash model)
                         │
              ┌──────────┴──────────┐
              │    Firebase Auth    │
              └─────────────────────┘
```

---

## Demand Flow

```
Passenger opens app
  → Selects stop → taps Signal
  → passengers/{uid} written: { status: "waiting", lat, lng, stop }
  → Demand circle appears on Driver and Admin maps (real-time)
  → Driver sees demand intensity → Departure Score updates
  → Driver taps Start Trip
  → Haversine sim writes lat/lng every 500ms
  → Animated jeep marker moves at 60fps on all views
  → Passenger ETA counts down
  → Driver taps Stop Trip → sim clears → status → idle
```

---

## What Pasada Is NOT

- Not a ride-hailing platform (no guaranteed pickup, no payment processing)
- Not a jeepney booking system (no seat reservation)
- Not a replacement for cooperative dispatch (it augments it with data)
- Not dependent on every driver installing independently (cooperative enrollment model)

---

## Known Limitations (Demo Scope)

| Limitation | Impact |
|---|---|
| Route scope: R01 only (Lumban → Sta. Cruz) | Demo covers one route; multi-route is architecture-ready |
| Simulation replaces real GPS for demo | Real deployment wires `useGPS` hook and `/drivers/gps` endpoint |
| Travel time hardcoded to 35 min | ORS travel-time integration is stubbed in `maps_service.py` |
| PIN not server-side validated | Demo-safe; real deployment adds server validation |
| `google-generativeai` deprecated | Emits `FutureWarning`; migrate to `google.genai` before production |
| Firestore security rules not hardened | Dev rules; needs audit before any public deployment |

---

## SDG Alignment

| SDG | Target | How Pasada Addresses It |
|---|---|---|
| SDG 11 | 11.2 — Safe, affordable, accessible transport | Reduces commuter wait time; optimizes PUV capacity utilization |
| SDG 11 | 11.b — Inclusive, sustainable urbanization | Gives cooperatives and LGUs real dispatch data for evidence-based decisions |
| SDG 9 | 9.1 — Resilient infrastructure | Adds a digital coordination layer to an existing analog transport system |

---

## Development Timeline — Actual

| Day | Date | Completed |
|---|---|---|
| Day 1 | June 28 | Repo setup, Firebase project, FastAPI scaffold, ORS polyline seed, role-based auth |
| Day 2 | June 29 | Passenger signal flow, driver map, demand heatmap, occupancy modal, jeep simulation, Departure Score |
| Day 3 | June 30 | 9-item improvement pass (haversine sim, density heatmap, signal toggle, recenter, AI confidence, Excel export, AI Insights), 4 bug fixes (Map constructor, setAt crash, auth race, CORS) |
| Day 4 | July 1 | QA, final demo prep, deploy |
