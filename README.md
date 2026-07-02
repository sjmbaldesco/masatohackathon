# Masato - Pasada

> *"Know when to ride. Know when to leave."*

**Pasada** is a demand-first public transport coordination platform for Philippine jeepney cooperatives, built by **Team Masato**.

> This project was developed for **SparkFest 2026** — GDG on Campus PUP · SDG 11 (Sustainable Cities & Communities).

**Live demo:** https://masatohackathon.vercel.app · **Repo:** https://github.com/sjmbaldesco/masatohackathon

---

## Project Brief

The Philippine jeepney system runs on a two-sided waiting problem. Passengers wait blindly at the curb with no ETA. Drivers idle at terminals until the jeep fills, blind to where passengers are. Cooperatives have no dispatch data. Both sides lose time, and low-income commuters absorb all the inefficiency. **This is not a technology gap — it is an information gap.**

Pasada digitizes the street-level demand that already exists. Passengers don't *book* a jeep — they *broadcast* that they're waiting. Drivers see live aggregated demand on a map and get an AI **Departure Confidence Score** on whether to depart now. Cooperatives see the full fleet picture in real time and export analytics with AI-generated insights. No ride-hailing, no booking, no legal complications.

---

## Team

**Masato** — SparkFest 2026, GDG on Campus PUP.

---

## Google Technologies Used

- **Firebase Authentication** — email/password sign-in for Passenger and Admin; Driver ID + PIN (synthetic email) for Drivers
- **Cloud Firestore** — single source of truth; every map and counter updates live via `onSnapshot` listeners across all three roles
- **Google Maps Platform** (Maps JavaScript API via `@react-google-maps/api`) — live route polylines, demand circles, animated jeep markers
- **Gemini API** (`gemini-1.5-flash`) — adjusts the Departure Confidence Score and writes the AI Insights sheet in the analytics export
- **Google Cloud** — underlying Firebase project infrastructure

---

## Live Demo — Test Accounts

Open https://masatohackathon.vercel.app and pick a role:

| Role | Login | Password / PIN |
|---|---|---|
| Passenger | `passenger@pasada.app` | `pass1234` |
| Admin | `admin001@pasada.app` | `123456` |
| Driver | Driver ID `DRV-01482` | `123456` |

Best experienced on three devices at once (Passenger + Driver on phones, Admin on desktop) — all views sync live.

---

## Features

### Passenger
- Select a boarding stop on a live Google Map (custom gray style, R01 route polyline)
- Tap **Signal** to broadcast waiting status; persists across page refresh (Firestore restore on mount)
- See other waiting passengers per stop ("N waiting" pills)
- Live ETA countdown with **Arriving Now** and **Currently Riding** states as the jeep approaches

### Driver
- Live demand heatmap — concentric circles per stop, color-coded by waiting count
- **Departure Confidence Score** — deterministic base (fill-ratio power curve + idle bonus) with a Gemini ±10 adjustment, 30s cache
- Update Occupancy bottom-sheet (SVG ring + stepper); **Start/End Trip** launches a simulated run along the ORS-generated polyline
- Smooth 60fps jeep marker (rAF interpolation between 500ms Firestore ticks, route-projected via shared hooks)

### Admin (Cooperative Dashboard)
- **Live Ops:** full R01 route, demand heatmap, per-unit status cards — all real-time
- **Analytics:** fleet KPIs (active drivers, total waiting, avg occupancy)
- **Export to Excel** — 4-sheet workbook (Summary, Drivers, Demand, AI Insights) with a Gemini-written narrative

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18.3, Vite 5.4, Tailwind CSS v3 |
| Maps | Google Maps Platform — `@react-google-maps/api` |
| Auth / Database | Firebase Authentication · Cloud Firestore |
| Backend | FastAPI + Uvicorn, Firebase Admin token verification |
| AI | Gemini `gemini-1.5-flash` via `google-generativeai` |
| Export | SheetJS `xlsx` |
| Hosting | Vercel (frontend) |

---

## Codebase Structure

```
frontend/src/
  pages/        RoleSelect · DriverLoginPage · PassengerAdminLogin
                DriverPage · PassengerPage · AdminDashboard
  components/
    driver/       ActiveTripMap · DemandHeatmap · DepartureScore
                  OccupancyModal · EndTripModal · QueueStatus
    passenger/    ETACard · RouteSelector · WaitingButton
    cooperative/  KPICards · AIInsights · RouteOverview
    shared/       Navbar · TabBar · ProtectedRoute · ErrorBoundary · LoadingSpinner
  hooks/        useAuth · useFirestore · useGPS · useIsMobile
                useRouteProgress · useRouteDemand · useSmoothedPosition
  services/     firebase.js · api.js · maps.js · sim.js
  context/      AuthContext (user + role)
backend/app/
  routes/       auth · passengers · drivers · demand · routes · ai · confidence · demo
  services/     firebase_service · gemini_service · maps_service
                confidence_score · demo_service
  models/       pydantic schemas (driver, passenger, demand, stop)
scripts/        seed.mjs (demo route + stops)
design/         Figma exports (visual source of truth)
```

### Firestore Schema

```
drivers/{uid}     uid, driver_name, plate, route, capacity, occupancy_count,
                  occupancy_pct, speed_kmh, lat, lng, current_stop, status, last_updated
passengers/{uid}  route, status ("waiting"|"boarded"), lat, lng, stop
routes/{id}       route_id ("R01"), name, polyline [{lat, lng}]
users/{uid}       uid, role ("passenger"|"driver"|"admin"), createdAt
```

Route **R01: Lumban → Sta. Cruz, Laguna** — 10 stops, 223-point ORS-generated polyline.

---

## Running Locally

Prerequisites: Node 20+, Python 3.12+, a Firebase project (Firestore + Auth), Google Maps API key, Gemini API key, `backend/serviceAccountKey.json`.

```bash
# Backend (:8000)
cd backend && pip install -r requirements.txt
# .env: GEMINI_API_KEY, FIREBASE_PROJECT_ID, ALLOWED_ORIGINS
uvicorn app.main:app --reload --port 8000

# Frontend (:3000)
cd frontend && npm install
# .env: VITE_FIREBASE_* keys, VITE_MAPS_API_KEY
npm run dev
```

---

## Demo Flow

1. **Admin** logs in → Live Ops shows the R01 route and demand map
2. **Passenger** signals at a stop → demand circle appears on all views in real time
3. **Driver** sees demand rise → Departure Confidence Score auto-fetches (Gemini)
4. Driver sets occupancy to 100% → Passenger sees **Full**, Admin unit turns red
5. Driver taps **Start Trip** → jeep animates along the route → Passenger ETA counts down
6. Admin → Analytics → **Export to Excel** → 4-sheet workbook with AI narrative

---

*Developed by Team Masato for SparkFest 2026 — GDG on Campus PUP.*
