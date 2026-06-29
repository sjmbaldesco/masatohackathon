import { useState, useEffect, useCallback } from "react";
import { GoogleMap, Marker, Polyline } from "@react-google-maps/api";
import { Home, DollarSign, User, MapPin, Zap, Users, Gauge, TrendingUp, LogOut } from "lucide-react";
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
  { id: "home", label: "Home", icon: Home },
  { id: "earnings", label: "Earnings", icon: DollarSign },
  { id: "profile", label: "Profile", icon: User },
];

const MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: false,
  streetViewControl: false,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
  ],
};

function StatChip({ icon: Icon, label, value, valueClass = "text-white" }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-white/10 py-2 px-1">
      <Icon size={14} className="text-white/40" strokeWidth={1.8} />
      <span className={`text-sm font-bold ${valueClass}`}>{value}</span>
      <span className="text-[9px] text-white/40 uppercase tracking-wide">{label}</span>
    </div>
  );
}

export default function DriverPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("home");
  const [showModal, setShowModal] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [scoreLoading, setScoreLoading] = useState(false);

  // Live driver doc
  const { data: driverDocs } = useCollection("drivers", [["uid", "==", user?.uid ?? "__none__"]]);
  const driver = driverDocs?.[0] ?? {};
  const tripActive = driver.status === "in_transit";

  // Live demand on route
  const { data: stops } = useCollection("stops", [["route", "==", ROUTE_ID]]);
  const totalWaiting = stops.reduce((s, st) => s + (st.count ?? 0), 0);

  // Route polyline from Firestore (fall back to demo polyline)
  const { data: routeDocs } = useCollection("routes");
  const route = routeDocs?.find((r) => r.route_id === ROUTE_ID) ?? {};
  const polyline = route.polyline?.length ? route.polyline : DEMO_POLYLINE;

  // Init driver doc on first load
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

  const occCount = driver.occupancy_count ?? 0;
  const occPct = Math.round((occCount / CAPACITY) * 100);
  const occHex = occupancyColor(occPct);

  return (
    <div className="flex h-screen max-w-[430px] mx-auto flex-col overflow-hidden bg-brand-dark font-manrope">
      {activeTab === "home" && (
        <HomeTab
          driver={driver}
          mapCenter={mapCenter}
          polyline={polyline}
          tripActive={tripActive}
          totalWaiting={totalWaiting}
          occCount={occCount}
          occHex={occHex}
          route={route}
          scoreData={scoreData}
          scoreLoading={scoreLoading}
          onFetchScore={fetchScore}
          onStartTrip={handleStartTrip}
          onEndTrip={handleEndTrip}
          onOpenModal={() => setShowModal(true)}
        />
      )}

      {activeTab === "earnings" && <EarningsTab driverUid={user?.uid} />}
      {activeTab === "profile" && (
        <ProfileTab driver={driver} onLogout={logout} />
      )}

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

function HomeTab({
  driver, mapCenter, polyline, tripActive, totalWaiting,
  occCount, occHex, route, scoreData, scoreLoading,
  onFetchScore, onStartTrip, onEndTrip, onOpenModal,
}) {
  const markerIcon = MAPS_API_KEY
    ? {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
        fillColor: "#F57C00",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
        scale: 1.4,
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
            options={MAP_OPTIONS}
          >
            {driver.lat && (
              <Marker
                position={{ lat: driver.lat, lng: driver.lng }}
                icon={markerIcon}
              />
            )}
            {tripActive && polyline.length > 1 && (
              <Polyline
                path={polyline.map(([lat, lng]) => ({ lat, lng }))}
                options={{ strokeColor: "#F57C00", strokeWeight: 4, strokeOpacity: 0.8 }}
              />
            )}
          </GoogleMap>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#1d2c4d]">
            <p className="text-white/30 text-sm text-center px-6">
              Add VITE_GOOGLE_MAPS_API_KEY to .env to show map
            </p>
          </div>
        )}
      </div>

      {/* Bottom gradient overlay */}
      <div
        className="absolute bottom-0 inset-x-0 z-10"
        style={{
          background:
            "linear-gradient(to top, rgba(26,26,46,1) 0%, rgba(26,26,46,0.95) 40%, rgba(26,26,46,0) 100%)",
          paddingTop: "80px",
        }}
      >
        {/* Route label */}
        <div className="px-4 pb-1">
          <p className="text-[11px] text-white/40 uppercase tracking-widest">Route</p>
          <p className="text-base font-bold text-white">
            {route.name ?? "Lumban → Sta. Cruz"}
          </p>
        </div>

        {/* Status strip */}
        <div className="flex gap-2 px-4 py-2">
          <StatChip
            icon={Users}
            label="Onboard"
            value={`${occCount}/${CAPACITY}`}
            valueClass=""
          />
          <StatChip icon={Gauge} label="Speed" value={`${driver.speed_kmh ?? 0}`} />
          <StatChip icon={MapPin} label="Stop" value={driver.current_stop ?? "—"} />
        </div>

        {/* Demand chip */}
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-brand-orange/20 border border-brand-orange/30 px-4 py-2.5">
          <Zap size={15} className="text-brand-orange shrink-0" />
          <span className="text-sm text-white/80">
            <span className="font-bold text-brand-orange">{totalWaiting}</span> passengers waiting on route
          </span>
        </div>

        {/* Departure Confidence Score */}
        <div className="px-4 pb-3">
          <DepartureScore
            score={scoreData?.score ?? null}
            expectedPassengers={scoreData?.expected_passengers}
            travelTimeMin={scoreData?.travel_time_min}
            expectedRevenue={scoreData?.expected_revenue}
            recommendation={scoreData?.recommendation}
            onRefresh={onFetchScore}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 px-4 pb-6">
          <button
            onClick={onOpenModal}
            className="flex-1 rounded-xl border border-white/20 bg-white/10 py-3.5 text-sm font-bold text-white hover:bg-white/20 transition"
          >
            Update Occupancy
          </button>
          {tripActive ? (
            <button
              onClick={onEndTrip}
              className="flex-1 rounded-xl bg-brand-red py-3.5 text-sm font-bold text-white"
            >
              End Trip
            </button>
          ) : (
            <button
              onClick={onStartTrip}
              className="flex-1 rounded-xl bg-brand-orange py-3.5 text-sm font-bold text-white"
            >
              Start Trip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EarningsTab({ driverUid }) {
  const { data: earnings } = useCollection(`earnings/${driverUid}/days`);
  const today = earnings?.find((e) => e.date === new Date().toISOString().slice(0, 10)) ?? {};

  const SEED_HISTORY = [
    { date: "Mon", trips: 4, gross: 1020 },
    { date: "Tue", trips: 5, gross: 1180 },
    { date: "Wed", trips: 3, gross: 840 },
    { date: "Thu", trips: 6, gross: 1450 },
    { date: "Fri", trips: 5, gross: 1240 },
    { date: "Sat", trips: 7, gross: 1680 },
    { date: "Sun", trips: 4, gross: 960 },
  ];

  const maxGross = Math.max(...SEED_HISTORY.map((d) => d.gross));

  return (
    <div className="flex-1 overflow-y-auto bg-brand-dark px-4 py-5 space-y-5">
      <h2 className="text-xl font-bold text-white">Earnings</h2>

      {/* Today KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KpiBox label="Today's Gross" value={`₱${today.gross ?? 0}`} accent="text-brand-green" />
        <KpiBox label="Trips Today" value={today.trips ?? 0} />
        <KpiBox label="Passengers" value={today.passengers ?? 0} />
      </div>

      {/* 7-day bar chart */}
      <div className="rounded-2xl bg-white/5 p-4">
        <p className="mb-4 text-xs text-white/40 uppercase tracking-widest">Last 7 Days</p>
        <div className="flex items-end gap-2 h-24">
          {SEED_HISTORY.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-brand-orange/70"
                style={{ height: `${(d.gross / maxGross) * 100}%` }}
              />
              <span className="text-[9px] text-white/30">{d.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-day rows */}
      <div className="rounded-2xl bg-white/5 divide-y divide-white/5">
        {SEED_HISTORY.slice().reverse().map((d) => (
          <div key={d.date} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">{d.date}</p>
              <p className="text-xs text-white/40">{d.trips} trips</p>
            </div>
            <p className="text-sm font-bold text-brand-green">₱{d.gross}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiBox({ label, value, accent = "text-white" }) {
  return (
    <div className="rounded-xl bg-white/5 p-3 text-center">
      <p className={`text-xl font-black ${accent}`}>{value}</p>
      <p className="text-[10px] text-white/40 mt-1">{label}</p>
    </div>
  );
}

function ProfileTab({ driver, onLogout }) {
  return (
    <div className="flex-1 overflow-y-auto bg-brand-dark px-4 py-5 space-y-5">
      <h2 className="text-xl font-bold text-white">Profile</h2>

      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/5 p-6">
        <div className="flex size-16 items-center justify-center rounded-full bg-brand-orange text-3xl font-black text-white">
          {driver.driver_name?.[0] ?? "D"}
        </div>
        <div className="text-center">
          <p className="font-bold text-white text-lg">{driver.driver_name ?? "Driver"}</p>
          <p className="text-sm text-white/40">{driver.plate ?? "ABC 1234"}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white/5 divide-y divide-white/5">
        {[
          { label: "Route", value: "Lumban → Sta. Cruz" },
          { label: "Capacity", value: `${driver.capacity ?? CAPACITY} seats` },
          { label: "Status", value: driver.status ?? "idle" },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-white/50">{label}</span>
            <span className="text-sm font-medium text-white capitalize">{value}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onLogout}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3.5 text-sm font-bold text-white/70"
      >
        <LogOut size={16} />
        Switch Role
      </button>
    </div>
  );
}
