import { useState, useEffect } from "react";
import { GoogleMap, Marker, Polyline } from "@react-google-maps/api";
import { Home, Map, User, LogOut, X, ChevronRight, Clock, Users } from "lucide-react";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useFirestore";
import { broadcastWaiting, cancelWaiting } from "../services/api";
import { db } from "../services/firebase";
import TabBar from "../components/shared/TabBar";
import { DEFAULT_CENTER, ROUTE_STOPS, MAPS_API_KEY, etaMinutes, occupancyColor, occupancyLabel } from "../services/maps";

const CAPACITY = 18;
const ROUTE_ID = "R01";
const ROUTE_FARE_BASE = 13;

const TABS = [
  { id: "home", label: "Home", icon: Home },
  { id: "map", label: "Map", icon: Map },
  { id: "profile", label: "Profile", icon: User },
];

const MAP_OPTIONS = {
  disableDefaultUI: true,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#e8ede8" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#6a7a6a" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#b3d4b3" }] },
  ],
};

export default function PassengerPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("home");
  const [selectedStop, setSelectedStop] = useState(ROUTE_STOPS[1]); // default: Town Plaza
  const [isWaiting, setIsWaiting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [etaStart, setEtaStart] = useState(null);

  // Live drivers on route
  const { data: drivers } = useCollection("drivers", [["route", "==", ROUTE_ID]]);
  const activeDrivers = drivers.filter((d) => d.status !== "ended");
  const nearestJeep = activeDrivers[0] ?? null;

  // Nearest jeep ETA (simple haversine / speed calc)
  const currentEta = nearestJeep?.lat && selectedStop
    ? etaMinutes(
        { lat: nearestJeep.lat, lng: nearestJeep.lng },
        { lat: selectedStop.lat, lng: selectedStop.lng },
        nearestJeep.speed_kmh || 30
      )
    : null;

  const etaProgress = etaStart && currentEta ? Math.max(0, Math.min(1, 1 - currentEta / etaStart)) : 0;

  // Set etaStart once when passenger first sees the jeep
  useEffect(() => {
    if (currentEta && !etaStart) setEtaStart(currentEta);
  }, [currentEta]);

  async function handleWait() {
    try {
      await broadcastWaiting({
        stop: selectedStop.name,
        route: ROUTE_ID,
        lat: selectedStop.lat,
        lng: selectedStop.lng,
      });
      setIsWaiting(true);
      setEtaStart(currentEta);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCancel() {
    try {
      await cancelWaiting(user.uid);
    } catch (e) {
      console.error(e);
    }
    setIsWaiting(false);
    setShowDetails(false);
  }

  return (
    <div className="flex h-screen max-w-[430px] mx-auto flex-col overflow-hidden bg-gray-50 font-manrope">
      {activeTab === "home" && (
        <HomeTab
          nearestJeep={nearestJeep}
          selectedStop={selectedStop}
          onSelectStop={setSelectedStop}
          isWaiting={isWaiting}
          onWait={handleWait}
          onCancel={handleCancel}
          onShowDetails={() => setShowDetails(true)}
          currentEta={currentEta}
          etaProgress={etaProgress}
        />
      )}

      {activeTab === "map" && (
        <MapTab nearestJeep={nearestJeep} selectedStop={selectedStop} />
      )}

      {activeTab === "profile" && (
        <ProfileTab onLogout={logout} />
      )}

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {showDetails && nearestJeep && (
        <JeepDetailsSheet jeep={nearestJeep} eta={currentEta} onClose={() => setShowDetails(false)} />
      )}
    </div>
  );
}

function HomeTab({ nearestJeep, selectedStop, onSelectStop, isWaiting, onWait, onCancel, onShowDetails, currentEta, etaProgress }) {
  const occCount = nearestJeep?.occupancy_count ?? 0;
  const isFull = occCount >= CAPACITY;
  const seats = CAPACITY - occCount;
  const occPct = Math.round((occCount / CAPACITY) * 100);
  const dotColor = occupancyColor(occPct);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-brand-dark px-4 pt-10 pb-4">
        <h1 className="text-2xl font-black text-white">Where are you going?</h1>
        {/* Stop selector */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {ROUTE_STOPS.map((stop) => (
            <button
              key={stop.id}
              onClick={() => onSelectStop(stop)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition
                ${selectedStop?.id === stop.id
                  ? "bg-brand-orange text-white"
                  : "bg-white/10 text-white/70"}`}
            >
              {stop.name}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Next jeep card */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          {/* ETA header */}
          <div className="bg-brand-dark px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-brand-orange" />
              <span className="text-sm font-bold text-white">
                {currentEta != null ? `${currentEta} min away` : "Locating jeep…"}
              </span>
            </div>
            <span className="text-xs text-white/40">
              {nearestJeep?.plate ?? "ABC 1234"}
            </span>
          </div>

          {/* ETA progress bar */}
          <div className="h-1.5 bg-gray-100">
            <div
              className="h-1.5 bg-brand-orange transition-all duration-1000"
              style={{ width: `${etaProgress * 100}%` }}
            />
          </div>

          {/* Jeep info */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-400">Route</p>
                <p className="font-bold text-gray-900">Lumban → Sta. Cruz</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Stop</p>
                <p className="font-bold text-gray-900">{selectedStop?.name}</p>
              </div>
            </div>

            {/* Seats + plate */}
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
                style={{ backgroundColor: isFull ? "#FFEBEE" : "#E8F5E9" }}
              >
                <div
                  className="size-2 rounded-full"
                  style={{ backgroundColor: dotColor }}
                />
                <span className="text-xs font-bold" style={{ color: dotColor }}>
                  {isFull ? "Full" : `${seats} seats`}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {occCount}/{CAPACITY} on board
              </span>
            </div>
          </div>
        </div>

        {/* "I'm waiting" / Cancel + Details */}
        {!isWaiting ? (
          <button
            onClick={onWait}
            className="w-full rounded-2xl bg-brand-red py-4 text-base font-bold text-white shadow"
          >
            I'm waiting at {selectedStop?.name}
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-brand-red py-4 text-sm font-bold text-brand-red"
            >
              <X size={16} />
              Cancel
            </button>
            <button
              onClick={onShowDetails}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-brand-dark py-4 text-sm font-bold text-white"
            >
              Jeepney Details
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {isWaiting && (
          <p className="text-center text-xs text-gray-400">
            Your wait has been broadcast · Driver sees your stop
          </p>
        )}
      </div>
    </div>
  );
}

function MapTab({ nearestJeep, selectedStop }) {
  const mapCenter = nearestJeep?.lat
    ? { lat: nearestJeep.lat, lng: nearestJeep.lng }
    : DEFAULT_CENTER;

  const fare = ROUTE_FARE_BASE + 2; // base + per km

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-brand-dark px-4 pt-10 pb-4">
        <h1 className="text-xl font-black text-white">Route Map</h1>
      </div>

      <div className="flex-1 relative">
        {MAPS_API_KEY ? (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={mapCenter}
            zoom={13}
            options={MAP_OPTIONS}
          >
            {nearestJeep?.lat && (
              <Marker
                position={{ lat: nearestJeep.lat, lng: nearestJeep.lng }}
                label={{ text: "🚌", fontSize: "20px" }}
              />
            )}
            {ROUTE_STOPS.map((stop) => (
              <Marker
                key={stop.id}
                position={{ lat: stop.lat, lng: stop.lng }}
                label={{ text: stop.name[0], color: "white", fontSize: "11px", fontWeight: "bold" }}
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE ?? 0,
                  fillColor: "#388E3C",
                  fillOpacity: 1,
                  strokeColor: "#fff",
                  strokeWeight: 2,
                  scale: 10,
                }}
              />
            ))}
          </GoogleMap>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <p className="text-gray-500 text-sm text-center px-6">
              Add VITE_GOOGLE_MAPS_API_KEY to show map
            </p>
          </div>
        )}
      </div>

      {/* Fare + stops info */}
      <div className="bg-white px-4 py-4 border-t border-gray-100 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Base fare</span>
          <span className="font-bold text-gray-900">₱{ROUTE_FARE_BASE}</span>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-2">Stops</p>
          <div className="flex items-center gap-1 overflow-x-auto">
            {ROUTE_STOPS.map((stop, i) => (
              <div key={stop.id} className="flex items-center gap-1 shrink-0">
                <span className="text-xs font-medium text-gray-700">{stop.name}</span>
                {i < ROUTE_STOPS.length - 1 && (
                  <ChevronRight size={12} className="text-gray-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ onLogout }) {
  return (
    <div className="flex-1 overflow-y-auto bg-brand-dark px-4 py-10 space-y-5">
      <h2 className="text-xl font-bold text-white">Profile</h2>

      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/5 p-6">
        <div className="flex size-16 items-center justify-center rounded-full bg-brand-green text-3xl font-black text-white">
          P
        </div>
        <div className="text-center">
          <p className="font-bold text-white text-lg">Passenger</p>
          <p className="text-sm text-white/40">Anonymous user</p>
        </div>
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

function JeepDetailsSheet({ jeep, eta, onClose }) {
  const occCount = jeep.occupancy_count ?? 0;
  const isFull = occCount >= CAPACITY;
  const seats = CAPACITY - occCount;
  const occPct = Math.round((occCount / CAPACITY) * 100);
  const dotColor = occupancyColor(occPct);

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl bg-white p-6 space-y-4 max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Jeepney Details</h2>
          <button onClick={onClose}>
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Occupancy bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Occupancy</span>
            <span className="font-bold" style={{ color: dotColor }}>
              {isFull ? "Full" : `${occCount}/${CAPACITY}`}
            </span>
          </div>
          <div className="h-3 rounded-full bg-gray-100">
            <div
              className="h-3 rounded-full transition-all"
              style={{ width: `${occPct}%`, backgroundColor: dotColor }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{seats} seats available</p>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Plate", value: jeep.plate ?? "ABC 1234" },
            { label: "Driver", value: jeep.driver_name ?? "J. Dela Cruz" },
            { label: "Speed", value: `${jeep.speed_kmh ?? 0} km/h` },
            { label: "Current Stop", value: jeep.current_stop ?? "—" },
            { label: "ETA", value: eta ? `${eta} min` : "—" },
            { label: "Route", value: "Lumban → Sta. Cruz" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-gray-50 p-3">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</p>
              <p className="font-bold text-gray-900 text-sm mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
