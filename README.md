# 🚍 Pasada

> *"Know when to ride. Know when to leave."*

A demand-first public transport coordination platform for jeepney cooperatives in Metro Manila.

---

## 🚀 About the Project

Pasada is developed for **SparkFest 2026**, a hackathon organized by **Google Developer Groups on Campus – Polytechnic University of the Philippines (GDG PUP)**.

**SDG Alignment:** SDG 11 — Sustainable Cities & Communities

---

## 🎯 Problem Statement

The Philippine jeepney system operates on a two-sided waiting problem. Passengers don't know when a jeep will arrive, so they wait blindly at the curb. Drivers don't know where passengers are, so they idle at terminals until the jeep fills up. Both sides lose time, cooperatives have no data to dispatch smarter, and low-income commuters — who depend on jeepneys most — absorb all the inefficiency.

**This is not a technology gap. It is an information gap.**

---

## 💡 Proposed Solution

Pasada digitizes the street-level information that already exists — where passengers are waiting, how many, and where they're going — and surfaces it to drivers and cooperative dispatchers in real time.

Passengers don't *book* a jeep. They *broadcast demand* by tapping "I'm waiting here." Drivers see aggregated demand along their route and make better departure decisions. Cooperatives see the full picture and can dispatch optimally. No ride-hailing, no legal complications — just smarter coordination of existing public transport.

---

## ⚙️ Features

**Passenger App**
- Select route and boarding stop
- View nearest jeep ETA, current occupancy, and available seats
- Tap "I'm waiting here" to broadcast location and contribute to the demand heatmap
- Receive push notification when a jeep is ~2 minutes away

**Driver Dashboard**
- Live demand heatmap showing passenger intensity per stop along the route
- Real-time seat queue status (on board / queued / remaining)
- **Departure Confidence Score** — AI-powered signal on whether to depart now or wait

**Cooperative Dashboard**
- Route-level overview: queue size, active units, and dispatch recommendations
- Live KPIs: average wait time, occupancy, daily revenue per unit, total waiting
- Gemini-powered dispatch insights and anomaly detection

**Live Demand Heatmap**
- Color-coded demand aggregated from passenger broadcasts — no individual pins
- Visible to drivers and dispatchers; updates in real time via Firestore listeners

**Departure Confidence Score** *(Killer Feature)*

Instead of telling a driver to "wait until full," Pasada estimates whether departing now is optimal:

```
Departure Confidence        92%

Expected passengers:        17–18
Expected travel time:       41 min
Expected revenue:           ₱320

[ Recommended: Depart Now ]
```

---

## 🤖 AI Integration

Gemini is used for decision support, not chat.

| Trigger | Output |
|---------|--------|
| Driver: "Should I leave now?" | Departure Confidence Score with reasoning |
| Dispatcher: "Why is demand low?" | Natural language route insight |
| Long wait detected at a stop | Dispatch recommendation with rationale |
| Passenger: "Which jeep should I take?" | ETA + occupancy recommendation |

---

## 🧪 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | Firebase Firestore (real-time) |
| Auth | Firebase Authentication (Google login) |
| Maps | Google Maps Platform — Maps JS, Directions, Distance Matrix, Geocoding |
| Real-time | Firestore listeners |
| Notifications | Firebase Cloud Messaging |
| AI | Gemini API (`gemini-1.5-flash`) |
| Backend hosting | Google Cloud Run |
| Frontend hosting | Firebase Hosting |

---

## 🗂️ Project Structure

```
pasada/
├── frontend/                        # React app
│   └── src/
│       ├── pages/                   # LoginPage, PassengerPage, DriverPage, CoopDashboard
│       ├── components/
│       │   ├── passenger/           # RouteSelector, WaitingButton, ETACard
│       │   ├── driver/              # DemandHeatmap, DepartureScore, QueueStatus
│       │   ├── cooperative/         # KPICards, RouteOverview, AIInsights
│       │   └── shared/              # Navbar, ProtectedRoute, LoadingSpinner
│       ├── hooks/                   # useAuth, useFirestore, useGPS
│       ├── services/                # firebase.js, api.js, maps.js
│       └── context/                 # AuthContext
│
├── backend/                         # FastAPI app
│   └── app/
│       ├── routes/                  # auth, passengers, drivers, demand, ai
│       ├── models/                  # Pydantic request/response schemas
│       ├── services/                # firebase_service, gemini_service, maps_service, confidence_score
│       └── middleware/              # Firebase token verification
│
├── firestore.rules                  # Security rules
├── firestore.indexes.json           # Composite indexes
└── firebase.json                    # Hosting + Firestore config
```

---

## 🚦 Demand Flow

```
Passenger opens app
  → Taps "I'm waiting at España"
  → Adds +1 to stop demand; heatmap updates
  → Driver sees España — high demand
  → Departure Confidence Score updates
  → Driver departs terminal
  → Passenger sees: 🚍 ETA 5 minutes
  → Demand auto-removes on jeep arrival
```

---

## 🏁 Getting Started

### Prerequisites
- Node.js 20+
- Python 3.12+
- Firebase project with Firestore + Auth enabled
- Google Cloud project with Maps Platform APIs enabled
- Gemini API key

### Frontend

```bash
cd frontend
npm install
cp .env.example .env     # fill in your Firebase + Maps keys
npm run dev              # http://localhost:3000
```

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # fill in service account path + API keys
# Place serviceAccountKey.json in backend/
uvicorn app.main:app --reload --port 8000
```

### Firebase

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,firestore:indexes
```

---

## 🌐 Deployed Project

- Live Demo: *(link after Day 4 deploy)*
- GitHub: https://github.com/sjmbaldesco/masatohackathon

---

## 👥 Team

Built for SparkFest 2026 — GDG PUP | Submission deadline: July 2, 2026
