import { useState, useEffect } from "react";
import { GoogleMap, Marker, Polyline } from "@react-google-maps/api";
import {
  Home, Map, List, User, LogOut, X, ChevronRight,
  Clock, Users, Search, MapPin, Navigation,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useFirestore";
import { broadcastWaiting, cancelWaiting } from "../services/api";
import TabBar from "../components/shared/TabBar";
import {
  DEFAULT_CENTER, ROUTE_STOPS, DEMO_POLYLINE,
  MAPS_API_KEY, etaMinutes, occupancyColor, occupancyLabel,
} from "../services/maps";

const CAPACITY = 18;
const ROUTE_ID = "R01";

const TABS = [
  { id: "home",    label: "HOME",    icon: Home      },
  { id: "map",     label: "MAP",     icon: Map       },
  { id: "queue",   label: "QUEUE",   icon: List      },
  { id: "profile", label: "PROFILE", icon: User      },
];

const WARM_MAP_OPTIONS = {
  disableDefaultUI: true,
  styles: [
    { elementType: "geometry",           stylers: [{ color: "#f0e8da" }] },
    { elementType: "labels.text.fill",   stylers: [{ color: "#7a5c42" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f0e8da" }] },
    { featureType: "road", elementType: "geometry",          stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffe8cc" }] },
    { featureType: "water", elementType: "geometry",         stylers: [{ color: "#bdd5e0" }] },
    { featureType: "poi",     stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
  ],
};

export default function PassengerPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab]     = useState("home");
  const [selectedStop, setSelectedStop] = useState(ROUTE_STOPS[1]);
  const [isWaiting, setIsWaiting]     = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [etaStart, setEtaStart]       = useState(null);

  const { data: drivers } = useCollection("drivers", [["route", "==", ROUTE_ID]]);
  const activeDrivers     = drivers.filter((d) => d.status !== "ended");
  const nearestJeep       = activeDrivers[0] ?? null;

  const currentEta = nearestJeep?.lat && selectedStop
    ? etaMinutes(
        { lat: nearestJeep.lat, lng: nearestJeep.lng },
        { lat: selectedStop.lat, lng: selectedStop.lng },
        nearestJeep.speed_kmh || 30
      )
    : null;

  const etaProgress = etaStart && currentEta
    ? Math.max(0, Math.min(1, 1 - currentEta / etaStart))
    : 0;

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
    <div className="flex h-screen max-w-[430px] mx-auto flex-col overflow-hidden bg-pasada-cream font-manrope">
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
      {activeTab === "map"     && <MapTab nearestJeep={nearestJeep} selectedStop={selectedStop} />}
      {activeTab === "queue"   && <QueueTab selectedStop={selectedStop} nearestJeep={nearestJeep} />}
      {activeTab === "profile" && <ProfileTab onLogout={logout} />}

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {showDetails && nearestJeep && (
        <JeepDetailsSheet
          jeep={nearestJeep}
          eta={currentEta}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  );
}

// ── Home Tab ──────────────────────────────────────────────────────────────────

function HomeTab({ nearestJeep, selectedStop, onSelectStop, isWaiting, onWait, onCancel, onShowDetails, currentEta, etaProgress }) {
  const occCount = nearestJeep?.occupancy_count ?? 0;
  const isFull   = occCount >= CAPACITY;
  const seats    = CAPACITY - occCount;
  const occPct   = Math.round((occCount / CAPACITY) * 100);
  const dotColor = occupancyColor(occPct);

  const mapCenter = nearestJeep?.lat
    ? { lat: nearestJeep.lat, lng: nearestJeep.lng }
    : DEFAULT_CENTER;

  const jeepIcon = MAPS_API_KEY
    ? {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
        fillColor: "#C2652A",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
        scale: 1.4,
        anchor: { x: 12, y: 22 },
      }
    : undefined;

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Map fills top portion */}
      <div className="absolute inset-0">
        {MAPS_API_KEY ? (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={mapCenter}
            zoom={14}
            options={WARM_MAP_OPTIONS}
          >
            {nearestJeep?.lat && (
              <Marker position={{ lat: nearestJeep.lat, lng: nearestJeep.lng }} icon={jeepIcon} />
            )}
            {ROUTE_STOPS.map((stop) => (
              <Marker
                key={stop.id}
                position={{ lat: stop.lat, lng: stop.lng }}
                icon={
                  MAPS_API_KEY
                    ? {
                        path: window.google?.maps?.SymbolPath?.CIRCLE ?? 0,
                        fillColor: selectedStop?.id === stop.id ? "#C2652A" : "#9A9088",
                        fillOpacity: 1,
                        strokeColor: "#fff",
                        strokeWeight: 2,
                        scale: selectedStop?.id === stop.id ? 9 : 7,
                      }
                    : undefined
                }
              />
            ))}
            <Polyline
              path={DEMO_POLYLINE.map(([lat, lng]) => ({ lat, lng }))}
              options={{ strokeColor: "#C2652A", strokeWeight: 3, strokeOpacity: 0.6 }}
            />
          </GoogleMap>
        ) : (
          <div className="w-full h-full bg-[#f0e8da] flex items-center justify-center">
            <p className="text-pasada-warm text-sm text-center px-6">
              Add VITE_GOOGLE_MAPS_API_KEY to show map
            </p>
          </div>
        )}
      </div>

      {/* Floating header / stop selector */}
      <div className="absolute top-0 inset-x-0 z-20 px-4 pt-10 pb-3">
        <div className="rounded-2xl bg-white/95 shadow-lg border border-pasada-border px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-pasada-muted mb-2">
            Your Stop
          </p>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {ROUTE_STOPS.map((stop) => (
              <button
                key={stop.id}
                onClick={() => onSelectStop(stop)}
                className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors
                  ${selectedStop?.id === stop.id
                    ? "bg-pasada-rust text-white"
                    : "bg-pasada-cream border border-pasada-border text-pasada-warm"
                  }`}
              >
                {stop.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 inset-x-0 z-10"
        style={{
          background:
            "linear-gradient(to top, rgba(250,245,238,1) 0%, rgba(250,245,238,0.97) 65%, rgba(250,245,238,0) 100%)",
          paddingTop: "60px",
        }}
      >
        <div className="px-4 space-y-3 pb-4">
          {/* Next jeep card */}
          <div className="rounded-2xl bg-white border border-pasada-border overflow-hidden shadow-sm">
            {/* ETA header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-pasada-border">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-pasada-rust" />
                <span className="text-sm font-bold text-pasada-dark">
                  {currentEta != null ? `${currentEta} min away` : "Locating jeep…"}
                </span>
              </div>
              <span className="text-xs text-pasada-muted">
                {nearestJeep?.plate ?? "ABC 1234"}
              </span>
            </div>

            {/* ETA progress bar */}
            <div className="h-1 bg-pasada-cream">
              <div
                className="h-1 bg-pasada-rust transition-all duration-1000"
                style={{ width: `${etaProgress * 100}%` }}
              />
            </div>

            {/* Info row */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-[11px] text-pasada-muted">Route</p>
                <p className="text-sm font-bold text-pasada-dark">Lumban → Sta. Cruz</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-pasada-muted">Stop</p>
                <p className="text-sm font-bold text-pasada-dark">{selectedStop?.name}</p>
              </div>
            </div>

            {/* Seats badge */}
            <div className="px-4 pb-3 flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 rounded-full px-3 py-1"
                style={{ backgroundColor: dotColor + "22" }}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: dotColor }} />
                <span className="text-xs font-bold" style={{ color: dotColor }}>
                  {isFull ? "Full" : `${seats} seats free`}
                </span>
              </div>
              <span className="text-xs text-pasada-muted">{occCount}/{CAPACITY} onboard</span>
            </div>
          </div>

          {/* Wait / Cancel buttons */}
          {!isWaiting ? (
            <button
              onClick={onWait}
              className="w-full rounded-2xl bg-pasada-rust py-4 text-base font-bold text-white shadow-sm hover:bg-pasada-rust/90 transition-colors"
            >
              I'm waiting at {selectedStop?.name}
            </button>
          ) : (
            <>
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-pasada-rust bg-white py-3.5 text-sm font-bold text-pasada-rust"
                >
                  <X size={15} />
                  Cancel Wait
                </button>
                <button
                  onClick={onShowDetails}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-pasada-dark py-3.5 text-sm font-bold text-white"
                >
                  Jeepney Details
                  <ChevronRight size={15} />
                </button>
              </div>
              <p className="text-center text-xs text-pasada-muted">
                Your wait is broadcast · Driver sees your stop
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Map Tab ───────────────────────────────────────────────────────────────────

function MapTab({ nearestJeep, selectedStop }) {
  const [query, setQuery] = useState("");

  const RECENT_ROUTES = [
    { id: 1, from: "Town Plaza", to: "Sta. Cruz", fare: "₱15" },
    { id: 2, from: "Lumban",     to: "Town Plaza", fare: "₱13" },
  ];

  const POPULAR = [
    { id: 1, name: "Sta. Cruz Market",   mins: "8 min"  },
    { id: 2, name: "Town Plaza",          mins: "4 min"  },
    { id: 3, name: "Pagsawitan Terminal", mins: "12 min" },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-pasada-cream">
      <div className="bg-white border-b border-pasada-border px-5 pt-10 pb-4">
        <h1 className="font-garamond text-3xl font-bold text-pasada-dark">Discover your Route</h1>
        {/* Search */}
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-pasada-cream border border-pasada-border px-3 py-2.5">
          <Search size={16} className="text-pasada-muted shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search destinations…"
            className="flex-1 bg-transparent text-sm text-pasada-dark placeholder-pasada-muted outline-none"
          />
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Recent routes */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-pasada-muted">
            Recent Routes
          </p>
          <div className="space-y-2">
            {RECENT_ROUTES.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl bg-white border border-pasada-border p-3"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-pasada-rust/10">
                  <Navigation size={16} className="text-pasada-rust" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-pasada-dark">
                    {r.from} → {r.to}
                  </p>
                  <p className="text-xs text-pasada-muted">Base fare {r.fare}</p>
                </div>
                <ChevronRight size={16} className="text-pasada-muted/60" />
              </div>
            ))}
          </div>
        </section>

        {/* Popular destinations */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-pasada-muted">
            Popular Destinations
          </p>
          <div className="space-y-2">
            {POPULAR.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl bg-white border border-pasada-border p-3"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-pasada-cream">
                  <MapPin size={16} className="text-pasada-warm" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-pasada-dark">{p.name}</p>
                  <p className="text-xs text-pasada-muted">~{p.mins} from your stop</p>
                </div>
                <ChevronRight size={16} className="text-pasada-muted/60" />
              </div>
            ))}
          </div>
        </section>

        {/* Stops on route */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-pasada-muted">
            Route 01 · Stops
          </p>
          <div className="rounded-2xl bg-white border border-pasada-border p-4">
            <div className="flex items-center gap-0">
              {ROUTE_STOPS.map((stop, i) => (
                <div key={stop.id} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex items-center w-full">
                    {i > 0 && <div className="flex-1 h-0.5 bg-pasada-rust/30" />}
                    <div className={`size-3 rounded-full border-2 ${i === 0 || i === ROUTE_STOPS.length - 1 ? "bg-pasada-rust border-pasada-rust" : "bg-white border-pasada-rust"}`} />
                    {i < ROUTE_STOPS.length - 1 && <div className="flex-1 h-0.5 bg-pasada-rust/30" />}
                  </div>
                  <span className="text-[9px] text-pasada-muted text-center leading-tight">{stop.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Queue Tab ─────────────────────────────────────────────────────────────────

function QueueTab({ selectedStop, nearestJeep }) {
  const { data: passengers } = useCollection("passengers", [
    ["status", "==", "waiting"],
    ["route",  "==", ROUTE_ID],
  ]);

  const byStop = ROUTE_STOPS.map((s) => ({
    ...s,
    count: passengers.filter((p) => p.stop === s.name).length,
  }));

  return (
    <div className="flex-1 overflow-y-auto bg-pasada-cream">
      <div className="bg-white border-b border-pasada-border px-5 pt-10 pb-4">
        <h1 className="font-garamond text-3xl font-bold text-pasada-dark">Passenger Queue</h1>
        <p className="text-sm text-pasada-muted mt-0.5">Live waiting demand by stop</p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Total waiting */}
        <div className="rounded-2xl bg-pasada-rust/10 border border-pasada-rust/20 p-4 flex items-center gap-3">
          <Users size={22} className="text-pasada-rust" />
          <div>
            <p className="text-xl font-black text-pasada-rust">
              {passengers.length}
            </p>
            <p className="text-xs text-pasada-warm">total waiting on route R01</p>
          </div>
        </div>

        {/* Per-stop breakdown */}
        {byStop.map((stop) => (
          <div
            key={stop.id}
            className="flex items-center justify-between rounded-xl bg-white border border-pasada-border px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-pasada-cream">
                <MapPin size={14} className="text-pasada-warm" />
              </div>
              <div>
                <p className="text-sm font-semibold text-pasada-dark">{stop.name}</p>
                <p className="text-xs text-pasada-muted">Stop on R01</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-pasada-dark">{stop.count}</p>
              <p className="text-[10px] text-pasada-muted">waiting</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab({ onLogout }) {
  return (
    <div className="flex-1 overflow-y-auto bg-pasada-cream">
      <div className="bg-white border-b border-pasada-border px-5 pt-10 pb-5">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-pasada-rust text-2xl font-black text-white">
            P
          </div>
          <div>
            <p className="text-lg font-bold text-pasada-dark">Passenger</p>
            <p className="text-sm text-pasada-muted">Anonymous user</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Trips Today",    value: "3"       },
            { label: "Avg Wait Time",  value: "6 min"   },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl bg-white border border-pasada-border p-4 text-center">
              <p className="text-2xl font-black text-pasada-dark">{value}</p>
              <p className="text-xs text-pasada-muted mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Preferences */}
        <div className="rounded-2xl bg-white border border-pasada-border divide-y divide-pasada-border">
          {[
            { label: "Default Route",   value: "Lumban → Sta. Cruz" },
            { label: "Default Stop",    value: "Town Plaza"          },
            { label: "Notifications",   value: "On"                  },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-pasada-muted">{label}</span>
              <span className="text-sm font-semibold text-pasada-dark">{value}</span>
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

// ── Jeep Details Sheet ────────────────────────────────────────────────────────

function JeepDetailsSheet({ jeep, eta, onClose }) {
  const occCount = jeep.occupancy_count ?? 0;
  const isFull   = occCount >= CAPACITY;
  const seats    = CAPACITY - occCount;
  const occPct   = Math.round((occCount / CAPACITY) * 100);
  const dotColor = occupancyColor(occPct);

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl bg-white p-6 space-y-4 max-h-[70vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-garamond text-2xl font-bold text-pasada-dark">Jeepney Details</h2>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-pasada-cream"
          >
            <X size={16} className="text-pasada-warm" />
          </button>
        </div>

        {/* Occupancy bar */}
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-pasada-muted text-xs font-semibold uppercase tracking-wide">
              Occupancy
            </span>
            <span className="font-bold text-sm" style={{ color: dotColor }}>
              {isFull ? "Full" : `${occCount}/${CAPACITY}`}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-pasada-cream">
            <div
              className="h-2.5 rounded-full transition-all"
              style={{ width: `${occPct}%`, backgroundColor: dotColor }}
            />
          </div>
          <p className="text-xs text-pasada-muted mt-1">{seats} seats available</p>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Plate",         value: jeep.plate         ?? "ABC 1234"       },
            { label: "Driver",        value: jeep.driver_name   ?? "J. Dela Cruz"   },
            { label: "Speed",         value: `${jeep.speed_kmh ?? 0} km/h`          },
            { label: "Current Stop",  value: jeep.current_stop  ?? "—"              },
            { label: "ETA",           value: eta ? `${eta} min`  : "—"              },
            { label: "Route",         value: "Lumban → Sta. Cruz"                   },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-pasada-cream p-3">
              <p className="text-[11px] text-pasada-muted uppercase tracking-wide">{label}</p>
              <p className="font-bold text-pasada-dark text-sm mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
