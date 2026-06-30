# Pasada — Project Context for Claude Chat
> Focus: Driver Page. Use this as full context when brainstorming fixes or features.

---

## 1. What is Pasada?

**Pasada** is a demand-first public transport coordination system for jeepney cooperatives in the Philippines (specifically the Lumban → Sta. Cruz, Laguna route). It is a hackathon project with three user roles:

- **Passenger** — sees live jeep locations, broadcasts their waiting status at stops
- **Driver** — runs the jeep, sees demand, reports occupancy, tracks their trip
- **Admin / Cooperative** — operations dashboard, live fleet view, analytics

The app is mobile-first (max-width 430px), styled in a warm cream/rust color palette called "Pasada Warm."

---

## 2. Tech Stack

### Frontend
| Layer | Choice |
|---|---|
| Framework | React 18 + Vite |
| Routing | React Router v6 |
| Styling | Tailwind CSS v3 with custom design tokens |
| Maps (Driver/Admin) | `@react-google-maps/api` v2.20 (Google Maps JS API) |
| Maps (ActiveTripMap component) | Leaflet + react-leaflet (OpenStreetMap / CARTO tiles) — **separate, currently unused in DriverPage** |
| Auth | Firebase Auth (Google OAuth popup + email/password + anonymous) |
| Database | Firebase Firestore (real-time listeners) |
| HTTP client | Axios with Firebase ID token interceptor |
| Icons | lucide-react |

### Backend
| Layer | Choice |
|---|---|
| Framework | FastAPI (Python) |
| Auth middleware | Firebase Admin SDK (verifies Bearer token) |
| AI | Google Gemini (`google-generativeai`) |
| Routing/Maps | OpenRouteService (ORS) — partially wired |
| Config | `pydantic-settings`, `.env` file |
| Run | Uvicorn with `--reload` |

### Infrastructure
- **Firebase project:** `pasada-0127`
- **Frontend:** `http://localhost:3000` (Vite dev server)
- **Backend:** `http://localhost:8000` (Uvicorn)
- **CORS:** backend allows `http://localhost:3000`

---

## 3. Environment Variables

### Frontend (`frontend/.env`)
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=pasada-0127.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=pasada-0127
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_VAPID_KEY
VITE_ORS_API_KEY          # OpenRouteService
VITE_GOOGLE_MAPS_API_KEY  # Required for Driver/Passenger/Admin maps
VITE_API_BASE_URL=http://localhost:8000
```

### Backend (`backend/.env`)
```
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
FIREBASE_PROJECT_ID=pasada-0127
GEMINI_API_KEY
ORS_API_KEY
APP_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

---

## 4. Firebase Firestore Schema

### `drivers/{uid}`
```js
{
  uid: string,
  driver_name: string,       // e.g. "J. Dela Cruz"
  plate: string,             // e.g. "ABC 1234"
  route: string,             // e.g. "R01"
  capacity: number,          // 18
  occupancy_count: number,   // passengers on board
  occupancy_pct: number,     // 0–100
  speed_kmh: number,
  lat: number,
  lng: number,
  current_stop: string,
  status: "idle" | "in_transit",
  last_updated: Timestamp,
}
```

### `stops/{id}`
```js
{ route: string, name: string, lat: number, lng: number, count: number }
```

### `passengers/{id}`
```js
{ route: string, status: "waiting" | "boarded", lat: number, lng: number, stop: string }
```

### `routes/{id}`
```js
{ route_id: string, name: string, polyline: [[lat, lng], ...] }
```

### `users/{uid}`
```js
{ uid: string, role: "passenger" | "driver" | "admin", createdAt: string, ... }
```

---

## 5. Auth Flow

`AuthContext.jsx` manages all auth:

- **`signInAsDriver(driverId, pin)`** — validates format (`/^DRV-\d{4,}$/`), then signs in **anonymously** via Firebase (pin is NOT verified against any backend — it's a UX stub). Sets Firestore `users/{uid}.role = "driver"`.
- **`signInWithGoogle(role)`** — Firebase Google popup, persists role to Firestore.
- **`signInWithEmail(email, password, role)`** — tries sign-in, falls back to account creation if user doesn't exist.
- **`ProtectedRoute`** — checks `role` from context; redirects to `/` if falsy, redirects to the user's correct route if role doesn't match.

**Known bug (fixed):** `App.jsx` was using static routes `/login/passenger` and `/login/admin` instead of `/login/:role`, so `useParams().role` was always `undefined`, causing auth to silently succeed but role to never be set, and ProtectedRoute kicking the user back to role-select.

---

## 6. Driver Page — Full Breakdown

### Entry point
`src/pages/DriverPage.jsx` — the entire driver experience.

### Route
`/driver` — protected, requires `role === "driver"`.

### Tab structure
```
HOME (map) | TRIPS | EARNINGS | MORE
```
Rendered by `TabBar` component. Only the HOME tab has real logic; TRIPS and EARNINGS use hardcoded mock data.

---

### 6a. HOME Tab — MapHomeTab

This is the core driver view. It renders:

1. **Full-screen Google Map** (behind everything)
2. **Status badge** (top center) — "In Transit" pulsing green dot OR driver name + plate
3. **Bottom overlay panel** (gradient fade from cream) containing:
   - Route label
   - Stat chips: Onboard count, Speed (km/h), Current stop
   - Demand chip: "X passengers waiting on route" (from Firestore `stops` collection)
   - Action buttons: **Update Occupancy** | **Start Trip / End Trip**

#### State sources (all real-time Firestore via `useCollection`):

| Data | Collection | Filter |
|---|---|---|
| Driver doc | `drivers` | `uid == user.uid` |
| Stops (for demand count) | `stops` | `route == "R01"` |
| Route polyline | `routes` | none (finds R01 from array) |

The driver document is **also initialized/merged** by the component on mount (via `setDoc` with `merge: true`), so if the Firestore doc doesn't exist it gets created with defaults.

#### Map setup
```jsx
// main.jsx — wraps entire app
<LoadScript googleMapsApiKey={MAPS_API_KEY} libraries={[]}>

// DriverPage — MapHomeTab
<GoogleMap
  center={DEFAULT_CENTER}   // { lat: 14.2976, lng: 121.475 } — Lumban, Laguna
  zoom={14}
  options={WARM_MAP_OPTIONS}  // custom cream/rust color scheme, no default UI
  onLoad={(map) => { mapRef.current = map; }}
>
  <Marker position={{ lat: driver.lat, lng: driver.lng }} icon={customPin} />
  <Polyline path={polyline} options={{ strokeColor: "#C2652A", ... }} />
</GoogleMap>
```

**Map following fix (already applied):** Previously `center={mapCenter}` was a controlled React prop that changed every second (from Firestore updates), causing the map to snap/lock to the jeep position and prevent panning. Fixed by:
- Passing stable `center={DEFAULT_CENTER}` (module constant, never changes reference)
- Capturing map instance via `onLoad` into a `mapRef`
- Using `useEffect` on `[driver.lat, driver.lng]` → calls `mapRef.current.panTo(...)` for smooth animated following

#### WARM_MAP_OPTIONS
Custom map style that gives Google Maps a cream/warm aesthetic:
```js
{
  disableDefaultUI: true,
  styles: [
    { elementType: "geometry",           color: "#f0e8da" },
    { elementType: "labels.text.fill",   color: "#7a5c42" },
    { featureType: "road",               color: "#ffffff" },
    { featureType: "road.arterial",      color: "#ffe8cc" },
    { featureType: "water",              color: "#bdd5e0" },
    { featureType: "poi",                visibility: "off" },
    { featureType: "transit",            visibility: "off" },
  ]
}
```

---

### 6b. Trip Simulation (`sim.js`)

When driver taps **Start Trip**, `handleStartTrip()` in DriverPage:
1. Sets Firestore `drivers/{uid}.status = "in_transit"`
2. Calls `startSim(user.uid, polyline, 30)` — starts a `setInterval` at 1000ms

The sim engine (`src/services/sim.js`):
- Interpolates position along the polyline at 30 km/h
- Every tick: writes `{ lat, lng, speed_kmh, current_stop, last_updated }` to Firestore
- `current_stop` is computed by `closestStop()` which uses Euclidean distance against `ROUTE_STOPS`
- Automatically calls `stopSim()` and sets `status: "idle"` when it reaches the end of the polyline

**When driver taps End Trip**, `handleEndTrip()`:
1. Calls `stopSim(user.uid)` — clears the interval
2. Sets Firestore `status: "idle", speed_kmh: 0`

**The sim writes directly to Firestore**, not through the backend API. The backend has a `POST /drivers/gps` endpoint that does the same thing, but the frontend sim bypasses it entirely.

---

### 6c. Occupancy Modal (`OccupancyModal.jsx`)

Bottom sheet modal triggered by "Update Occupancy" button. Features:
- SVG circular progress ring (color: green → rust → red by fill %)
- Quick level buttons: EMPTY / QUARTER / HALF FULL / ALMOST FULL
- Exact stepper: − / count / +
- Save → calls `handleSaveOccupancy(count)` which writes `occupancy_count` and `occupancy_pct` to Firestore

---

### 6d. Departure Score (`DepartureScore.jsx` + backend)

The "killer feature" — an AI-powered score telling the driver whether to depart now or wait.

**Frontend:** `DepartureScore` component renders score (0–100%), expected passengers, travel time, expected revenue, and a recommendation badge.

**Backend flow** (`GET /drivers/{driver_id}/confidence`):
1. Reads driver's Firestore doc (route, lat, lng, occupancy)
2. Counts waiting passengers in `passengers` collection with `status == "waiting"` on same route
3. Calls Gemini API with a prompt about demand vs capacity
4. Falls back to heuristic if Gemini fails: `score = min((on_board + waiting) / 18 * 100, 100)`
5. Returns `{ score, expected_passengers, travel_time_min, expected_revenue, recommendation }`

**Known issue:** `travel_time_min` is hardcoded to `35` — ORS integration is a stub.

---

### 6e. ActiveTripMap Component (`components/driver/ActiveTripMap.jsx`)

**This component exists but is NOT currently used in DriverPage.** It's a separate Leaflet-based map designed for an active-trip full-screen view with:
- CARTO Voyager tile layer (OpenStreetMap, no API key needed, no billing watermark)
- Custom jeep SVG marker icon
- `RecenterMap` sub-component using `useMap()` hook — calls `map.setView()` on every position update (same locking bug pattern as the Google Maps one, but in Leaflet)
- HUD overlay: occupancy card + speed card
- NextStopPill: shows next stop name + ETA in minutes
- Action buttons: Update Occupancy + End Route

This component's API:
```jsx
<ActiveTripMap
  routeLabel="Lumban → Santa Cruz"
  occupancy={12}
  capacity={18}
  speed={30}
  nextStop={{ name: "Pagsawitan", etaMin: 4 }}
  driverPosition={{ lat: 14.29, lng: 121.45 }}
  onMenuOpen={fn}
  onChatOpen={fn}
  onUpdateOccupancy={fn}
  onEndRoute={fn}
/>
```

---

### 6f. useGPS Hook (`hooks/useGPS.js`)

Exists but **not used anywhere** in DriverPage yet. It wraps `navigator.geolocation.watchPosition` with:
- High accuracy enabled
- Throttled push via `setInterval` (default 7500ms)
- Returns `{ position: { lat, lng }, error }`

The driver page currently uses the **simulation engine** (`sim.js`) instead of real GPS. For real deployment, `useGPS` would replace or run alongside `sim.js`.

---

### 6g. Backend GPS Endpoint (also unused by DriverPage)

`POST /drivers/gps` exists in the backend but is **never called** from the frontend driver page. The sim writes directly to Firestore. The endpoint is defined in `backend/app/routes/drivers.py` and expects:
```json
{ "lat": 14.29, "lng": 121.45, "occupancy": 12, "route": "R01" }
```

---

## 7. Data Flow Diagram

```
Driver taps "Start Trip"
  └─► handleStartTrip()
        ├─► setDoc(drivers/{uid}, { status: "in_transit" })  [Firestore write]
        └─► startSim(uid, polyline, 30)
              └─► setInterval (every 1s)
                    └─► setDoc(drivers/{uid}, { lat, lng, speed_kmh, current_stop })

Firestore real-time listener (useCollection)
  └─► driver state updates in React
        ├─► mapRef.current.panTo({ lat, lng })  [smooth map follow]
        ├─► StatChips re-render (speed, stop, occupancy)
        └─► tripActive = driver.status === "in_transit"
```

---

## 8. Known Bugs & Status

| # | Bug | Status | Fix |
|---|---|---|---|
| 1 | Map shows "For development purposes only" watermark | **Not a code bug** | Google Cloud billing must be enabled for `pasada-0127` project |
| 2 | Map snaps/locks to GPS position every second during trip | **Fixed** | Replaced controlled `center` prop with `mapRef` + `panTo()` in useEffect |
| 3 | Login fails even with Google sign-in | **Fixed** | App.jsx now uses `/login/:role` dynamic route instead of two static paths |
| 4 | Firestore role write fails silently (passes `role: undefined`) | **Fixed** (same fix as #3) | Role is now correctly extracted from URL param |
| 5 | `ActiveTripMap` component exists but is not wired into DriverPage | **Open** | Could replace or augment the current Google Maps view |
| 6 | `useGPS` hook exists but is not used — sim always runs instead of real GPS | **Open** | Real deployment needs this wired up |
| 7 | `POST /drivers/gps` backend endpoint is never called — sim bypasses it | **Open** | Sim should call the backend endpoint instead of writing Firestore directly |
| 8 | `travel_time_min` in Departure Score is hardcoded to 35 | **Open** | ORS integration stub needs completion |
| 9 | Driver PIN is not validated — any 4+ digit PIN is accepted | **Open** | Backend has no PIN verification endpoint |
| 10 | `RecenterMap` in `ActiveTripMap` calls `map.setView()` on every position update | **Open** | Same locking bug as the fixed one, if ActiveTripMap ever gets used |

---

## 9. File Map (Driver-relevant)

```
frontend/src/
├── main.jsx                          # LoadScript wrapper (Google Maps)
├── App.jsx                           # Routes — /driver uses DriverPage
├── context/AuthContext.jsx           # Auth state, signInAsDriver, role management
├── hooks/
│   ├── useFirestore.js               # useCollection() — real-time Firestore listener
│   └── useGPS.js                     # Real GPS hook (unused in driver flow)
├── services/
│   ├── firebase.js                   # Firebase app, auth, db, googleProvider
│   ├── maps.js                       # MAPS_API_KEY, DEFAULT_CENTER, DEMO_POLYLINE, utils
│   ├── sim.js                        # Simulation engine — animates jeep along polyline
│   └── api.js                        # Axios instance — updateDriverGPS, getDepartureScore
├── pages/
│   └── DriverPage.jsx                # Main driver page (tabs: home/trips/earnings/more)
└── components/driver/
    ├── ActiveTripMap.jsx             # Leaflet map component (UNUSED in DriverPage)
    ├── OccupancyModal.jsx            # Bottom sheet for updating passenger count
    ├── DepartureScore.jsx            # AI score display card
    ├── DemandHeatmap.jsx             # (exists, not in DriverPage yet)
    └── QueueStatus.jsx               # (exists, not in DriverPage yet)

backend/app/
├── main.py                           # FastAPI app, CORS setup
├── config.py                         # Settings (Firebase, Gemini, ORS, CORS origins)
├── routes/
│   ├── auth.py                       # GET /auth/me
│   └── drivers.py                    # POST /drivers/gps, GET /drivers/{id}/confidence
├── models/
│   └── driver.py                     # GPSUpdateRequest, DepartureScoreResponse
├── services/
│   ├── firebase_service.py           # Admin SDK wrappers (get_doc, set_doc, query)
│   ├── gemini_service.py             # Gemini prompt builder + API call
│   ├── confidence_score.py           # Departure Score logic (Gemini + heuristic fallback)
│   └── maps_service.py               # ORS integration (partial)
└── middleware/
    └── auth_middleware.py            # Firebase token verification → get_current_user
```

---

## 10. Design Tokens (Tailwind)

```js
colors: {
  pasada: {
    cream:    "#FAF5EE",    // page background
    rust:     "#C2652A",    // primary action color
    dark:     "#3A302A",    // headings, primary text
    warm:     "#605850",    // secondary text
    muted:    "#9A9088",    // labels, placeholders
    border:   "rgba(216,208,200,0.6)",
    card:     "rgba(255,255,255,0.95)",
    overlay:  "rgba(250,245,238,0.9)",
  },
  brand: {
    red:    "#D32F2F",   // occupancy: full / danger
    orange: "#F57C00",  // occupancy: half
    green:  "#388E3C",  // occupancy: available / depart now
    dark:   "#1A1A2E",  // DepartureScore card background
  }
}
fontFamily: {
  garamond: ["EB Garamond", "Georgia", "serif"],  // headings
  manrope:  ["Manrope", "sans-serif"],             // body/UI
}
```

---

## 11. Things That Don't Exist Yet (Potential Features)

- Real GPS integration (hook exists, not wired)
- Driver PIN verification (backend endpoint needed)
- `DemandHeatmap` and `QueueStatus` components wired into DriverPage
- ORS-based travel time in Departure Score
- `ActiveTripMap` (Leaflet, no API key/billing needed) replacing the Google Maps view during active trips
- Actual trip history from Firestore (currently hardcoded mock data)
- Earnings from Firestore (currently hardcoded mock data)
- Backend GPS push during trips (sim bypasses it)
