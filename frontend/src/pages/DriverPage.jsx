import { useState, useEffect } from "react";
import { GoogleMap, Marker, Polyline } from "@react-google-maps/api";
import {
  Home, Navigation, DollarSign, Bell, MoreHorizontal,
  MapPin, Gauge, Users, Zap, ChevronRight, LogOut,
  TrendingUp, Clock, Bus,
} from "lucide-react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useFirestore";
import { getDepartureScore } from "../services/api";
import { db } from "../services/firebase";
import TabBar from "../components/shared/TabBar";
import DepartureScore from "../components/driver/DepartureScore";
import OccupancyModal from "../components/driver/OccupancyModal";
import { startSim, stopSim } from "../services/sim";
import { DEFAULT_CENTER, DEMO_POLYLINE, MAPS_API_KEY, occupancyColor } from "../services/maps";

const CAPACITY = 18;
const ROUTE_ID = "R01";

const TABS = [
  { id: "home",     label: "HOME",     icon: Home          },
  { id: "trips",    label: "TRIPS",    icon: Navigation    },
  { id: "earnings", label: "EARNINGS", icon: DollarSign    },
  { id: "alerts",   label: "ALERTS",   icon: Bell          },
  { id: "more",     label: "MORE",     icon: MoreHorizontal },
];

const WARM_MAP_OPTIONS = {
  disableDefaultUI: true,
  styles: [
    { elementType: "geometry",            stylers: [{ color: "#f0e8da" }] },
    { elementType: "labels.text.fill",    stylers: [{ color: "#7a5c42" }] },
    { elementType: "labels.text.stroke",  stylers: [{ color: "#f0e8da" }] },
    { featureType: "road", elementType: "geometry",         stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffe8cc" }] },
    { featureType: "water", elementType: "geometry",        stylers: [{ color: "#bdd5e0" }] },
    { featureType: "poi",     stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
  ],
};

export default function DriverPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("home");
  const [showModal, setShowModal] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [scoreLoading, setScoreLoading] = useState(false);

  const { data: driverDocs } = useCollection("drivers", [["uid", "==", user?.uid ?? "__none__"]]);
  const driver = driverDocs?.[0] ?? {};
  const tripActive = driver.status === "in_transit";

  const { data: stops } = useCollection("stops", [["route", "==", ROUTE_ID]]);
  const totalWaiting = stops.reduce((s, st) => s + (st.count ?? 0), 0);

  const { data: routeDocs } = useCollection("routes");
  const route = routeDocs?.find((r) => r.route_id === ROUTE_ID) ?? {};
  const polyline = route.polyline?.length ? route.polyline : DEMO_POLYLINE;

  useEffect(() => {
    if (!user?.uid) return;
    setDoc(
      doc(db, "drivers", user.uid),
      {
        uid: user.uid,
        driver_name: "J. Dela Cruz",
        plate: "ABC 1234",
        route: ROUTE_ID,
        capacity: CAPACITY,
        occupancy_count: 0,
        occupancy_pct: 0,
        speed_kmh: 0,
        lat: DEFAULT_CENTER.lat,
        lng: DEFAULT_CENTER.lng,
        current_stop: "Lumban",
        status: "idle",
      },
      { merge: true }
    ).catch(console.error);
  }, [user?.uid]);

  const mapCenter =
    driver.lat && driver.lng
      ? { lat: driver.lat, lng: driver.lng }
      : DEFAULT_CENTER;

  const occCount = driver.occupancy_count ?? 0;
  const occPct   = Math.round((occCount / CAPACITY) * 100);
  const occHex   = occupancyColor(occPct);

  async function handleStartTrip() {
    await setDoc(
      doc(db, "drivers", user.uid),
      { status: "in_transit", last_updated: serverTimestamp() },
      { merge: true }
    );
    startSim(user.uid, polyline, 30);
  }

  async function handleEndTrip() {
    stopSim(user.uid);
    await setDoc(
      doc(db, "drivers", user.uid),
      { status: "idle", speed_kmh: 0, last_updated: serverTimestamp() },
      { merge: true }
    );
  }

  async function handleSaveOccupancy(count) {
    const pct = Math.round((count / CAPACITY) * 100);
    await setDoc(
      doc(db, "drivers", user.uid),
      { occupancy_count: count, occupancy_pct: pct, last_updated: serverTimestamp() },
      { merge: true }
    );
    setShowModal(false);
  }

  async function fetchScore() {
    setScoreLoading(true);
    try {
      const res = await getDepartureScore(user.uid);
      setScoreData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setScoreLoading(false);
    }
  }

  return (
    <div className="flex h-screen max-w-[430px] mx-auto flex-col overflow-hidden bg-pasada-cream font-manrope">
      {activeTab === "home" && (
        tripActive
          ? <ActiveTripTab
              driver={driver}
              mapCenter={mapCenter}
              polyline={polyline}
              totalWaiting={totalWaiting}
              occCount={occCount}
              occHex={occHex}
              route={route}
              scoreData={scoreData}
              scoreLoading={scoreLoading}
              onFetchScore={fetchScore}
              onEndTrip={handleEndTrip}
              onOpenModal={() => setShowModal(true)}
            />
          : <IdleHomeTab
              driver={driver}
              totalWaiting={totalWaiting}
              route={route}
              scoreData={scoreData}
              scoreLoading={scoreLoading}
              onFetchScore={fetchScore}
              onStartTrip={handleStartTrip}
              onOpenModal={() => setShowModal(true)}
            />
      )}
      {activeTab === "trips"    && <TripsTab />}
      {activeTab === "earnings" && <EarningsTab />}
      {activeTab === "alerts"   && <AlertsTab totalWaiting={totalWaiting} />}
      {activeTab === "more"     && <MoreTab driver={driver} onLogout={logout} />}

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {showModal && (
        <OccupancyModal
          capacity={CAPACITY}
          currentCount={occCount}
          onSave={handleSaveOccupancy}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ── Idle Home ─────────────────────────────────────────────────────────────────

function IdleHomeTab({ driver, totalWaiting, route, scoreData, scoreLoading, onFetchScore, onStartTrip, onOpenModal }) {
  const TODAY = [
    { label: "Trips",      value: "4"    },
    { label: "Passengers", value: "72"   },
    { label: "Earnings",   value: "₱840" },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-pasada-cream">
      {/* Header */}
      <div className="bg-white border-b border-pasada-border px-5 pt-10 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-pasada-muted">Driver Mode</p>
            <h1 className="font-garamond text-3xl font-bold text-pasada-dark mt-0.5">
              {driver.driver_name ?? "J. Dela Cruz"}
            </h1>
            <p className="text-sm text-pasada-warm mt-0.5">{driver.plate ?? "ABC 1234"}</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1.5">
            <span className="size-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-green-700">Online</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Route card */}
        <div className="rounded-2xl bg-white border border-pasada-border p-4 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-pasada-rust/10">
            <Bus size={22} className="text-pasada-rust" strokeWidth={1.8} />
          </div>
          <div className="flex-1">
            <p className="text-xs text-pasada-muted uppercase tracking-wide">Current Route</p>
            <p className="font-bold text-pasada-dark">{route.name ?? "Lumban → Sta. Cruz"}</p>
            <p className="text-xs text-pasada-muted mt-0.5">Route 01 · 18 seats</p>
          </div>
          <ChevronRight size={18} className="text-pasada-muted/60" />
        </div>

        {/* Today stats */}
        <div className="grid grid-cols-3 gap-3">
          {TODAY.map(({ label, value }) => (
            <div key={label} className="rounded-2xl bg-white border border-pasada-border p-3 text-center">
              <p className="text-lg font-black text-pasada-dark">{value}</p>
              <p className="text-[10px] text-pasada-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Waiting demand chip */}
        {totalWaiting > 0 && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-pasada-rust/10 border border-pasada-rust/20 px-4 py-3">
            <Zap size={16} className="text-pasada-rust shrink-0" />
            <p className="text-sm text-pasada-dark">
              <span className="font-bold text-pasada-rust">{totalWaiting}</span> passengers waiting on route
            </p>
          </div>
        )}

        {/* Departure score */}
        <DepartureScore
          score={scoreData?.score ?? null}
          expectedPassengers={scoreData?.expected_passengers}
          travelTimeMin={scoreData?.travel_time_min}
          expectedRevenue={scoreData?.expected_revenue}
          recommendation={scoreData?.recommendation}
          onRefresh={onFetchScore}
        />

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onOpenModal}
            className="flex-1 rounded-xl border-2 border-pasada-border bg-white py-3.5 text-sm font-bold text-pasada-dark hover:bg-pasada-cream transition-colors"
          >
            Update Occupancy
          </button>
          <button
            onClick={onStartTrip}
            className="flex-1 rounded-xl bg-pasada-rust py-3.5 text-sm font-bold text-white hover:bg-pasada-rust/90 transition-colors"
          >
            Start New Trip
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Active Trip Map ────────────────────────────────────────────────────────────

function ActiveTripTab({ driver, mapCenter, polyline, totalWaiting, occCount, occHex, route, scoreData, scoreLoading, onFetchScore, onEndTrip, onOpenModal }) {
  const markerIcon = MAPS_API_KEY
    ? {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
        fillColor: "#C2652A",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
        scale: 1.5,
        anchor: { x: 12, y: 22 },
      }
    : undefined;

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Map */}
      <div className="absolute inset-0">
        {MAPS_API_KEY ? (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={mapCenter}
            zoom={15}
            options={WARM_MAP_OPTIONS}
          >
            {driver.lat && (
              <Marker position={{ lat: driver.lat, lng: driver.lng }} icon={markerIcon} />
            )}
            {polyline.length > 1 && (
              <Polyline
                path={polyline.map(([lat, lng]) => ({ lat, lng }))}
                options={{ strokeColor: "#C2652A", strokeWeight: 4, strokeOpacity: 0.8 }}
              />
            )}
          </GoogleMap>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#f0e8da]">
            <p className="text-pasada-warm text-sm text-center px-6">
              Add VITE_GOOGLE_MAPS_API_KEY to .env to show map
            </p>
          </div>
        )}
      </div>

      {/* IN TRANSIT badge */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-1.5 rounded-full bg-white/90 shadow-lg border border-pasada-border px-4 py-1.5">
          <span className="size-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-bold text-pasada-dark uppercase tracking-wide">In Transit</span>
        </div>
      </div>

      {/* Bottom overlay */}
      <div
        className="absolute bottom-0 inset-x-0 z-10"
        style={{
          background:
            "linear-gradient(to top, rgba(250,245,238,1) 0%, rgba(250,245,238,0.97) 55%, rgba(250,245,238,0) 100%)",
          paddingTop: "80px",
        }}
      >
        {/* Route label */}
        <div className="px-4 pb-1">
          <p className="text-[11px] text-pasada-muted uppercase tracking-widest">Route</p>
          <p className="text-base font-bold text-pasada-dark">
            {route.name ?? "Lumban → Sta. Cruz"}
          </p>
        </div>

        {/* Status strip */}
        <div className="flex gap-2 px-4 py-2">
          <StatChip icon={Users}  label="Onboard" value={`${occCount}/${CAPACITY}`} hex={occHex} />
          <StatChip icon={Gauge}  label="Speed"   value={`${driver.speed_kmh ?? 0} km/h`} />
          <StatChip icon={MapPin} label="Stop"    value={driver.current_stop ?? "—"} />
        </div>

        {/* Demand chip */}
        {totalWaiting > 0 && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-pasada-rust/10 border border-pasada-rust/20 px-4 py-2.5">
            <Zap size={15} className="text-pasada-rust shrink-0" />
            <span className="text-sm text-pasada-dark">
              <span className="font-bold text-pasada-rust">{totalWaiting}</span> passengers waiting on route
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 px-4 pb-6">
          <button
            onClick={onOpenModal}
            className="flex-1 rounded-xl border-2 border-pasada-border bg-white py-3.5 text-sm font-bold text-pasada-dark hover:bg-pasada-cream transition-colors"
          >
            Update Occupancy
          </button>
          <button
            onClick={onEndTrip}
            className="flex-1 rounded-xl bg-red-600 py-3.5 text-sm font-bold text-white hover:bg-red-700 transition-colors"
          >
            End Trip
          </button>
        </div>
      </div>
    </div>
  );
}

function StatChip({ icon: Icon, label, value, hex }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-white/80 border border-pasada-border py-2 px-1">
      <Icon size={13} className="text-pasada-muted" strokeWidth={1.8} />
      <span className="text-sm font-bold text-pasada-dark" style={hex ? { color: hex } : {}}>
        {value}
      </span>
      <span className="text-[9px] text-pasada-muted uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ── Trips Tab ─────────────────────────────────────────────────────────────────

const TRIP_HISTORY = [
  { id: 1, date: "Today",       time: "08:15 AM", passengers: 14, fare: "₱182", status: "completed" },
  { id: 2, date: "Today",       time: "10:40 AM", passengers: 18, fare: "₱234", status: "completed" },
  { id: 3, date: "Yesterday",   time: "07:30 AM", passengers: 12, fare: "₱156", status: "completed" },
  { id: 4, date: "Yesterday",   time: "09:55 AM", passengers: 16, fare: "₱208", status: "completed" },
  { id: 5, date: "Mon, Dec 23", time: "08:00 AM", passengers: 11, fare: "₱143", status: "completed" },
];

function TripsTab() {
  const [filter, setFilter] = useState("all");
  const filters = ["all", "today", "this week"];

  return (
    <div className="flex-1 overflow-y-auto bg-pasada-cream">
      <div className="bg-white border-b border-pasada-border px-5 pt-10 pb-4">
        <h1 className="font-garamond text-3xl font-bold text-pasada-dark">Trip History</h1>
        <div className="mt-3 flex gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors
                ${filter === f
                  ? "bg-pasada-rust text-white"
                  : "bg-pasada-cream border border-pasada-border text-pasada-warm"
                }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {TRIP_HISTORY.map((trip) => (
          <div
            key={trip.id}
            className="flex items-center gap-3 rounded-2xl bg-white border border-pasada-border p-4"
          >
            <div className="w-1 self-stretch rounded-full bg-pasada-rust/40" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-pasada-muted">{trip.date} · {trip.time}</p>
                <p className="font-bold text-pasada-rust">{trip.fare}</p>
              </div>
              <p className="font-semibold text-pasada-dark mt-0.5">Lumban → Sta. Cruz</p>
              <div className="flex items-center gap-1 mt-1">
                <Users size={12} className="text-pasada-muted" />
                <span className="text-xs text-pasada-muted">{trip.passengers} passengers</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Earnings Tab ──────────────────────────────────────────────────────────────

const WEEK_DATA = [
  { day: "Mon", gross: 1020 },
  { day: "Tue", gross: 1180 },
  { day: "Wed", gross: 840  },
  { day: "Thu", gross: 1450 },
  { day: "Fri", gross: 1240 },
  { day: "Sat", gross: 1680 },
  { day: "Sun", gross: 960  },
];

function EarningsTab() {
  const maxGross = Math.max(...WEEK_DATA.map((d) => d.gross));
  const total    = WEEK_DATA.reduce((s, d) => s + d.gross, 0);
  const trips    = 34;
  const best     = Math.max(...WEEK_DATA.map((d) => d.gross));

  return (
    <div className="flex-1 overflow-y-auto bg-pasada-cream">
      <div className="bg-white border-b border-pasada-border px-5 pt-10 pb-4">
        <h1 className="font-garamond text-3xl font-bold text-pasada-dark">Driver Earnings</h1>
        <p className="text-sm text-pasada-muted mt-0.5">This week's performance</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Gross", value: `₱${total.toLocaleString()}`, accent: "text-pasada-rust" },
            { label: "Total Trips", value: trips },
            { label: "Best Day",    value: `₱${best.toLocaleString()}`, accent: "text-green-600" },
          ].map(({ label, value, accent }) => (
            <div key={label} className="rounded-2xl bg-white border border-pasada-border p-3 text-center">
              <p className={`text-lg font-black ${accent ?? "text-pasada-dark"}`}>{value}</p>
              <p className="text-[10px] text-pasada-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="rounded-2xl bg-white border border-pasada-border p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-pasada-muted">
            Last 7 Days
          </p>
          <div className="flex items-end gap-2 h-24">
            {WEEK_DATA.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-pasada-rust/70"
                  style={{ height: `${(d.gross / maxGross) * 100}%` }}
                />
                <span className="text-[9px] text-pasada-muted">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily rows */}
        <div className="rounded-2xl bg-white border border-pasada-border divide-y divide-pasada-border">
          {WEEK_DATA.slice().reverse().map((d) => (
            <div key={d.day} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-pasada-dark">{d.day}</p>
                <p className="text-xs text-pasada-muted">
                  {Math.round(d.gross / 260)} trips
                </p>
              </div>
              <p className="text-sm font-bold text-pasada-rust">₱{d.gross.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Alerts Tab ────────────────────────────────────────────────────────────────

function AlertsTab({ totalWaiting }) {
  const alerts = [
    { id: 1, type: "demand",  title: "High Demand Alert",     body: `${totalWaiting} passengers waiting on route R01.`,   time: "Just now" },
    { id: 2, type: "info",    title: "Peak Hours Approaching", body: "Expected surge between 5–7 PM today.",                time: "1h ago"   },
    { id: 3, type: "success", title: "Trip Completed",         body: "Trip #4 completed. Fare: ₱234. 18 passengers.",      time: "2h ago"   },
  ];

  const typeStyle = {
    demand:  { bg: "bg-red-50",    dot: "bg-red-500",   text: "text-red-700"   },
    info:    { bg: "bg-blue-50",   dot: "bg-blue-500",  text: "text-blue-700"  },
    success: { bg: "bg-green-50",  dot: "bg-green-500", text: "text-green-700" },
  };

  return (
    <div className="flex-1 overflow-y-auto bg-pasada-cream">
      <div className="bg-white border-b border-pasada-border px-5 pt-10 pb-4">
        <h1 className="font-garamond text-3xl font-bold text-pasada-dark">Alerts</h1>
      </div>

      <div className="px-4 py-4 space-y-3">
        {alerts.map((a) => {
          const s = typeStyle[a.type];
          return (
            <div key={a.id} className={`rounded-2xl ${s.bg} border border-pasada-border p-4`}>
              <div className="flex items-start gap-3">
                <span className={`mt-1 size-2.5 shrink-0 rounded-full ${s.dot}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-bold ${s.text}`}>{a.title}</p>
                    <p className="text-[10px] text-pasada-muted">{a.time}</p>
                  </div>
                  <p className="text-sm text-pasada-warm mt-0.5">{a.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── More Tab ──────────────────────────────────────────────────────────────────

function MoreTab({ driver, onLogout }) {
  const items = [
    { label: "Route",    value: "Lumban → Sta. Cruz" },
    { label: "Capacity", value: `${driver.capacity ?? CAPACITY} seats` },
    { label: "Status",   value: driver.status ?? "idle" },
    { label: "Rating",   value: "4.8 / 5.0" },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-pasada-cream">
      <div className="bg-white border-b border-pasada-border px-5 pt-10 pb-5">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-pasada-rust text-2xl font-black text-white">
            {driver.driver_name?.[0] ?? "D"}
          </div>
          <div>
            <p className="text-lg font-bold text-pasada-dark">{driver.driver_name ?? "J. Dela Cruz"}</p>
            <p className="text-sm text-pasada-muted">{driver.plate ?? "ABC 1234"}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="rounded-2xl bg-white border border-pasada-border divide-y divide-pasada-border">
          {items.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-pasada-muted">{label}</span>
              <span className="text-sm font-semibold text-pasada-dark capitalize">{value}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-pasada-border bg-white py-3.5 text-sm font-bold text-pasada-warm hover:bg-pasada-cream transition-colors"
        >
          <LogOut size={16} />
          Switch Role
        </button>
      </div>
    </div>
  );
}
