# 🚍 Pasada — Product Requirements Document

> *"Know when to ride. Know when to leave."*

**Version:** 1.0  
**Hackathon:** SparkFest 2026 — GDG PUP  
**SDG Alignment:** SDG 11 — Sustainable Cities & Communities  
**Submission Deadline:** July 2, 2026  
**Repo:** https://github.com/sjmbaldesco/masatohackathon.git

---

## 🎯 Problem Statement

The Philippine jeepney system operates on a two-sided waiting problem:

- **Passengers** don't know when a jeep will arrive — so they wait blindly at the curb.
- **Drivers** don't know where passengers are — so they wait at terminals until the jeep fills up.

Both sides lose time. Cooperatives have no data to dispatch smarter. The result is inefficient routes, long wait times, and underutilized units — all of which disproportionately affect low-income commuters who depend on jeepneys as their primary mode of transport.

**This is not a technology gap. It is an information gap.**

---

## 💡 Proposed Solution

Pasada is a demand-first public transport coordination platform for jeepney cooperatives. It digitizes the street-level information that already exists — where passengers are waiting, how many, and where they're going — and surfaces it to drivers and cooperative dispatchers in real time.

**What makes it different:**

- Passengers don't *book* a jeep (no ride-hailing, no legal complications).
- Passengers *broadcast demand* — they signal they are waiting at a stop.
- Drivers see aggregated demand along their route and make better departure decisions.
- Cooperatives see the full picture and can dispatch optimally.

> Think of it as Grab — but without booking a private vehicle. You're matching demand with an existing public transport route.

---

## 👥 Users & Stakeholders

| User | Role | Primary Need |
|------|------|-------------|
| **Passenger** | Demand broadcaster | Know when a jeep is coming; signal they're waiting |
| **Driver** | Supply operator | Know where passengers are before departing |
| **Cooperative Dispatcher** | Fleet coordinator | Optimize dispatch across all active units |
| **LGU / LTFRB / MMDA** | Regulators & partners | Route efficiency data and compliance insights |

---

## ⚙️ Core Features

### 1. Passenger App

- Select route (e.g., Cubao → Divisoria)
- View nearest jeep info:
  - ETA
  - Current occupancy (%)
  - Seats available
- Tap **"I'm waiting here"** to broadcast location and contribute to demand heatmap
- Receive push notification when jeep is ~2 minutes away
- Google Account required (Firebase Authentication via Google login)

### 2. Driver Dashboard

- View live passenger demand heatmap showing intensity per stop along the route
- See seat queue status:
  ```
  Jeep #15   Capacity: 18   On Board: 9   Queued: 7   Remaining: 2
  ```
- Receive **Departure Confidence Score** (see Killer Feature below)
- GPS auto-updates every 5–10 seconds to Firestore

### 3. Cooperative Dashboard

- Route-level overview:
  ```
  Route A   |   Passenger Queue: 42   |   Active Jeeps: 3   |   Recommended: Dispatch 2 more
  ```
- Live KPIs:
  - Average wait time
  - Average occupancy
  - Average daily revenue per unit
  - Total passengers waiting
- Dispatch recommendations powered by Gemini API
- Historical analytics (busiest stops, peak hours, demand trends)

### 4. Live Demand Heatmap

A color-coded demand heatmap visible to both drivers and dispatchers, aggregated from passenger location broadcasts:

```
🔴 18 waiting — España
🟠 10 waiting — UST
🟢  2 waiting — Recto
```

No individual pins — demand is shown as heat intensity per stop. Drivers immediately know where to go. This is the core data advantage of the platform.

---

## ⭐ Killer Feature — Departure Confidence Score

Instead of telling a driver to "wait until full," Pasada estimates whether departing *now* is profitable using:

- Number of passengers already waiting along the route
- Historical boarding patterns for that time of day
- Current traffic conditions (Google Maps Directions API)
- Live passenger demand from the app

**Example output:**

```
Departure Confidence        92%

Expected passengers before destination:   17–18
Expected travel time:                     41 min
Expected revenue:                         ₱320

[ Recommended: Depart Now ]
```

This reframes the system from "find my jeepney" into "optimize the entire route." It addresses the incentive of every stakeholder simultaneously.

---

## 🤖 AI Integration (Gemini API)

Gemini is used for **decision support**, not chat. Specific use cases:

| Trigger | Gemini Output |
|---------|---------------|
| Driver asks "Should I leave now?" | Analyzes queue, traffic, demand → returns Departure Confidence Score |
| Dispatcher asks "Why is demand low?" | Analyzes time, weather, historical data → returns natural language insight |
| System detects long wait at a stop | Suggests dispatch of additional unit with reasoning |
| Passenger asks "Which jeep should I take?" | Returns recommendation based on ETA, occupancy, and traffic |

---

## 🧪 Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | React.js + Tailwind CSS |
| **Backend** | FastAPI (Python) |
| **Database** | Firebase Firestore (real-time) |
| **Authentication** | Firebase Authentication (Google login) |
| **Maps & Routing** | Google Maps Platform — Maps JS API, Directions API, Routes API, Distance Matrix API, Geocoding API |
| **Real-time Updates** | Firestore real-time listeners |
| **Notifications** | Firebase Cloud Messaging |
| **AI** | Gemini API |
| **Backend Hosting** | Google Cloud Run |
| **Frontend Hosting** | Firebase Hosting / Vercel |
| **Version Control** | Git + GitHub |

---

## 🗄️ Data Model (Firestore)

### `drivers` collection
```json
{
  "driver_id": "JP001",
  "lat": 14.610,
  "lng": 121.000,
  "occupancy": 70,
  "route": "Cubao-Divisoria",
  "status": "active",
  "last_updated": "2026-06-28T10:00:00Z"
}
```

### `passengers` collection
```json
{
  "passenger_id": "P001",
  "lat": 14.612,
  "lng": 121.002,
  "stop": "España",
  "route": "Cubao-Divisoria",
  "status": "waiting",
  "timestamp": "2026-06-28T10:01:00Z"
}
```

### `routes` collection
```json
{
  "route_id": "R01",
  "name": "Cubao-Divisoria",
  "stops": ["Cubao", "España", "UST", "Morayta", "Recto", "Divisoria"],
  "active_drivers": 3,
  "total_waiting": 42
}
```

### Additional collections: `stops`, `queue`, `requests`, `cooperatives`

---

## 🏗️ System Architecture

```
        Passenger App (React)          Driver App (React)
                │                              │
                └──────────────┬───────────────┘
                               │
                        Google Maps API
                               │
                               ▼
                         FastAPI Backend
                               │
         ┌─────────────────────┼──────────────────────┐
         │                     │                      │
   Firebase Auth          Firestore DB           Gemini API
         │                     │                      │
         └─────────────────────┼──────────────────────┘
                               │
                  Cooperative Dashboard (React)
                               │
                    GPS + Demand Analytics
                               │
                               ▼
                  Google Cloud Run (Backend)
                  Firebase Hosting (Frontend)
```

---

## 🚦 How the Demand Flow Works

```
Passenger opens app
        ↓
Taps "I'm waiting at UST"
        ↓
Adds +1 to stop demand, heatmap updates
        ↓
Driver sees: UST — high demand (heatmap)
        ↓
Departure Confidence Score updates
        ↓
Driver departs terminal
        ↓
Passenger sees: 🚍 ETA 5 minutes
        ↓
Passenger demand auto-removes on jeep arrival
```

No reservation. No payment. No legal complications. **You're digitizing what already happens on the street.**

---

## 📵 What Pasada Is NOT

- ❌ Not a ride-hailing platform (no guaranteed pickup, no payment)
- ❌ Not a jeepney booking system (no seat reservation)
- ❌ Not a replacement for cooperative dispatch (it augments it)
- ❌ Not dependent on every driver installing the app (cooperative enrollment model solves adoption)

---

## ✅ Why This Wins the Adoption Problem

**The fatal flaw of transport apps:** "Why would every driver install this?"

Pasada's answer: **Drivers don't adopt it individually. Cooperatives enroll their fleet.**

The cooperative is the customer. Drivers get the app as part of their cooperative membership. This mirrors how Grab onboards drivers through fleet partners — not one by one.

**Value to each stakeholder:**

| Stakeholder | What They Get |
|-------------|---------------|
| Passenger | Shorter wait, real-time ETA, no more blind waiting |
| Driver | Departure Confidence Score, less idle time, higher revenue |
| Cooperative | Dispatch optimization, route analytics, revenue data |
| LGU / LTFRB | Compliance data, route efficiency metrics |

---

## 📅 Development Timeline

### Day 1 — June 28 (Today)
- [ ] Finalize concept and assign roles
- [ ] Set up GitHub repo and branch structure
- [ ] Initialize FastAPI backend project
- [ ] Set up Firebase project (Firestore + Auth)
- [ ] Wireframe all three UI views (Passenger, Driver, Dashboard)

### Day 2 — June 29
- [ ] Backend: Auth, GPS update endpoint, demand pin endpoint
- [ ] Frontend: Passenger app scaffold with Google Maps
- [ ] Frontend: Driver dashboard scaffold
- [ ] Firestore real-time listeners connected to frontend
- [ ] Begin cooperative dashboard

### Day 3 — June 30
- [ ] Departure Confidence Score logic (backend)
- [ ] Gemini API integration (dispatch recommendations)
- [ ] Demand heatmap on passenger and driver map
- [ ] Firebase Cloud Messaging for arrival alerts
- [ ] Full integration test

### Day 4 — July 1
- [ ] Final QA and bug fixes
- [ ] Deploy backend to Google Cloud Run
- [ ] Deploy frontend to Firebase Hosting
- [ ] Finalize README and pitch deck
- [ ] Rehearse demo
- [ ] Submit before July 2 deadline

---

## 🌐 SDG Alignment

| SDG | Target | How Pasada Addresses It |
|-----|--------|------------------------|
| **SDG 11** | 11.2 — Safe, affordable, accessible transport | Reduces wait time and improves PUV efficiency for urban commuters |
| **SDG 11** | 11.b — Inclusive, sustainable urbanization policies | Provides cooperatives and LGUs with data to make evidence-based transport decisions |
| **SDG 9** | 9.1 — Resilient infrastructure | Digital infrastructure layer for an existing analog transport system |

**Social Inclusion angle:** Pasada's demand broadcasting requires no smartphone for basic participation — a simple tap at a stop kiosk (future scope) or basic SMS fallback can extend access to commuters without data plans, ensuring the platform serves all income levels, not just smartphone users.

---

## 🔗 Resources

- **Repo:** https://github.com/sjmbaldesco/masatohackathon.git
- **OpenRouteService Docs:** https://openrouteservice.org/dev/#/api-docs
- **Leaflet Docs:** https://leafletjs.com/reference.html
- **Firebase Docs:** https://firebase.google.com/docs
- **Gemini API:** https://ai.google.dev
- **FastAPI Docs:** https://fastapi.tiangolo.com
- **SparkFest 2026 — GDG PUP**
