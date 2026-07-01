import { useState, useEffect, useRef, useMemo } from "react";
import { getDoc, doc } from "firebase/firestore";
import { GoogleMap, Marker, PolylineF, DirectionsRenderer, OverlayView } from "@react-google-maps/api";
import {
  Home, Map as MapIcon, User, LogOut, X, ChevronRight,
  Clock, Search, MapPin, Bus, Mic, LocateFixed,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useFirestore";
import { broadcastWaiting, cancelWaiting } from "../services/api";
import { db } from "../services/firebase";
import TabBar from "../components/shared/TabBar";
import {
  DEFAULT_CENTER, ROUTE_STOPS, DEMO_POLYLINE, GRAY_MAP_STYLE,
  MAPS_API_KEY, etaMinutes, occupancyColor, occupancyLabel,
} from "../services/maps";

const CAPACITY = 18;
const ROUTE_ID = "R01";

const TABS = [
  { id: "home",    label: "HOME",    icon: Home },
  { id: "map",     label: "MAP",     icon: MapIcon  },
  { id: "profile", label: "PROFILE", icon: User },
];

const MAP_OPTIONS = { disableDefaultUI: true, styles: GRAY_MAP_STYLE };

export default function PassengerPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab]     = useState("home");
  const [selectedStop, setSelectedStop] = useState(ROUTE_STOPS[0]);
  const [isWaiting, setIsWaiting]     = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [etaStart, setEtaStart]       = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      null,
      { enableHighAccuracy: true, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Restore waiting state on mount (in case of page reload)
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    getDoc(doc(db, "passengers", user.uid)).then((snap) => {
      if (cancelled || !snap.exists()) return;
      const data = snap.data();
      if (data.status === "waiting") {
        setIsWaiting(true);
        const stop = ROUTE_STOPS.find((s) => s.name === data.stop);
        if (stop) setSelectedStop(stop);
      }
    });
    return () => { cancelled = true; };
  }, [user?.uid]);

  const { data: drivers } = useCollection("drivers", [["route", "==", ROUTE_ID]]);
  const activeDrivers     = drivers.filter((d) => d.status !== "ended" && d.lat && d.lng);

  // Other passengers currently waiting on this route — read live so everyone
  // (not just the driver/admin) can see demand at each stop, not just the jeep.
  const { data: waitingPassengers } = useCollection(
    "passengers", [["route", "==", ROUTE_ID], ["status", "==", "waiting"]]
  );
  const waitingCounts = useMemo(() => {
    const counts = {};
    for (const p of waitingPassengers) {
      if (p.stop) counts[p.stop] = (counts[p.stop] ?? 0) + 1;
    }
    return counts;
  }, [waitingPassengers]);
  // Pick the jeep with the smallest ETA to the selected stop
  const nearestJeep = selectedStop
    ? activeDrivers.reduce((best, d) => {
        if (!best) return d;
        const dEta = etaMinutes({ lat: d.lat, lng: d.lng }, selectedStop, d.speed_kmh || 30);
        const bEta = etaMinutes({ lat: best.lat, lng: best.lng }, selectedStop, best.speed_kmh || 30);
        return dEta < bEta ? d : best;
      }, null)
    : activeDrivers[0] ?? null;

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
          allJeeps={activeDrivers}
          selectedStop={selectedStop}
          onSelectStop={setSelectedStop}
          isWaiting={isWaiting}
          onWait={handleWait}
          onCancel={handleCancel}
          onShowDetails={() => setShowDetails(true)}
          currentEta={currentEta}
          etaProgress={etaProgress}
          userLocation={userLocation}
          waitingCounts={waitingCounts}
        />
      )}
      {activeTab === "map" && (
        <MapTab
          nearestJeep={nearestJeep}
          allJeeps={activeDrivers}
          selectedStop={selectedStop}
          onSelectStop={setSelectedStop}
          userLocation={userLocation}
          waitingCounts={waitingCounts}
        />
      )}
      {activeTab === "profile" && <ProfileTab user={user} onLogout={logout} />}

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

function HomeTab({ nearestJeep, allJeeps = [], selectedStop, onSelectStop, isWaiting, onWait, onCancel, onShowDetails, currentEta, etaProgress, userLocation, waitingCounts = {} }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [directions,  setDirections]  = useState(null);
  const mapRef = useRef(null);

  const occCount = nearestJeep?.occupancy_count ?? 0;
  const isFull   = occCount >= CAPACITY;
  const seats    = CAPACITY - occCount;
  const occPct   = Math.round((occCount / CAPACITY) * 100);
  const dotColor = occupancyColor(occPct);

  const mapCenter = nearestJeep?.lat
    ? { lat: nearestJeep.lat, lng: nearestJeep.lng }
    : DEFAULT_CENTER;

  const jeepIcon = MAPS_API_KEY ? {
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
    fillColor: "#EF233C", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: 1.4,
    anchor: { x: 12, y: 22 },
  } : undefined;

  const jeepStopIdx  = ROUTE_STOPS.findIndex((s) => s.name === nearestJeep?.current_stop);
  const jeepRoutePct = jeepStopIdx >= 0 ? jeepStopIdx / (ROUTE_STOPS.length - 1) : etaProgress;

  const filteredStops = searchQuery
    ? ROUTE_STOPS.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : ROUTE_STOPS;

  function selectStop(stop) {
    onSelectStop(stop);
    setSearchQuery(stop.name);
    setSearchOpen(false);
    mapRef.current?.panTo({ lat: stop.lat, lng: stop.lng });
  }

  // Directions: jeep → selected stop; falls back to user location or route start
  useEffect(() => {
    if (!selectedStop || !window.google?.maps) return;
    const origin = nearestJeep?.lat
      ? { lat: nearestJeep.lat, lng: nearestJeep.lng }
      : userLocation ?? { lat: ROUTE_STOPS[0].lat, lng: ROUTE_STOPS[0].lng };
    new window.google.maps.DirectionsService().route(
      { origin, destination: { lat: selectedStop.lat, lng: selectedStop.lng }, travelMode: "DRIVING" },
      (result, status) => { if (status === "OK") setDirections(result); }
    );
  }, [selectedStop?.id, !!nearestJeep?.lat]);

  function recenterOnJeep() {
    if (nearestJeep?.lat && mapRef.current)
      mapRef.current.panTo({ lat: nearestJeep.lat, lng: nearestJeep.lng });
    else if (userLocation && mapRef.current)
      mapRef.current.panTo(userLocation);
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Map */}
      <div className="absolute inset-0">
        {MAPS_API_KEY ? (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={mapCenter}
            zoom={14}
            options={MAP_OPTIONS}
            onLoad={(map) => { mapRef.current = map; }}
          >
            {/* User location — person icon */}
            {userLocation && <PersonMarker position={userLocation} />}

            {/* Directions route (real roads) or fallback demo polyline */}
            {directions ? (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  polylineOptions: { strokeColor: "#EF233C", strokeWeight: 4, strokeOpacity: 0.75 },
                }}
              />
            ) : (
              <PolylineF
                path={DEMO_POLYLINE.map(([lat, lng]) => ({ lat, lng }))}
                options={{ strokeColor: "#EF233C", strokeWeight: 3, strokeOpacity: 0.6 }}
              />
            )}

            {/* Stop markers — clickable to set destination; badge shows other
                passengers currently waiting there */}
            {ROUTE_STOPS.map((stop) => (
              <PassengerStopMarker
                key={stop.id}
                stop={stop}
                isSelected={selectedStop?.id === stop.id}
                waitingCount={waitingCounts[stop.name] ?? 0}
                onClick={() => selectStop(stop)}
              />
            ))}

            {/* All active jeepney markers */}
            {allJeeps.map((jeep) => (
              <Marker
                key={jeep.uid ?? jeep.id}
                position={{ lat: jeep.lat, lng: jeep.lng }}
                icon={{
                  ...jeepIcon,
                  fillColor: jeep.uid === nearestJeep?.uid ? "#EF233C" : "#8D99AE",
                  scale: jeep.uid === nearestJeep?.uid ? 1.4 : 1.1,
                }}
              />
            ))}
          </GoogleMap>
        ) : (
          <div className="w-full h-full bg-[#edf2f4] flex items-center justify-center">
            <p className="text-pasada-warm text-sm text-center px-6">
              Add VITE_GOOGLE_MAPS_API_KEY to show map
            </p>
          </div>
        )}
      </div>

      {/* Floating search bar */}
      <div className="absolute top-0 inset-x-0 z-20 px-4 pt-10 pb-3">
        <div className="rounded-2xl bg-white/95 shadow-lg border border-pasada-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Search size={15} className="text-pasada-muted shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              placeholder="Where to?"
              className="flex-1 bg-transparent text-sm text-pasada-dark placeholder-pasada-muted outline-none"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }}>
                <X size={14} className="text-pasada-muted" />
              </button>
            )}
            <button className="text-pasada-muted/60">
              <Mic size={15} />
            </button>
          </div>

          {searchOpen && (
            <div className="mt-2 space-y-0.5">
              {filteredStops.map((stop) => (
                <button
                  key={stop.id}
                  onMouseDown={() => selectStop(stop)}
                  className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-left hover:bg-pasada-cream transition-colors"
                >
                  <MapPin size={13} className={selectedStop?.id === stop.id ? "text-pasada-rust" : "text-pasada-muted"} />
                  <span className={selectedStop?.id === stop.id ? "font-semibold text-pasada-rust" : "text-pasada-dark"}>
                    {stop.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recenter button */}
      <RecenterButton onClick={recenterOnJeep} />

      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 inset-x-0 z-10"
        style={{
          background:
            "linear-gradient(to top, rgba(237,242,244,1) 0%, rgba(237,242,244,0.97) 65%, rgba(237,242,244,0) 100%)",
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

            {/* Route progress — pill track with bus icon */}
            <div className="px-4 pt-3 pb-1">
              <div className="relative h-8">
                {/* Track pill */}
                <div className="absolute inset-0 rounded-full bg-pasada-cream border border-pasada-border/60" />
                {/* Fill */}
                <div
                  className="absolute left-0 top-0 bottom-0 rounded-full bg-pasada-rust/25 transition-all duration-1000"
                  style={{ width: `${Math.max(jeepRoutePct * 100, 6)}%` }}
                />
                {/* Stop tick marks */}
                {ROUTE_STOPS.map((stop, i) => {
                  const pct = i / (ROUTE_STOPS.length - 1);
                  return (
                    <div
                      key={stop.id}
                      className={`absolute top-1/2 w-0.5 h-3 -translate-y-1/2 -translate-x-1/2 ${
                        stop.id === selectedStop?.id ? "bg-pasada-dark" : "bg-pasada-border"
                      }`}
                      style={{ left: `${pct * 100}%` }}
                    />
                  );
                })}
                {/* Bus icon at leading edge of fill */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 transition-all duration-1000"
                  style={{ left: `${Math.max(jeepRoutePct * 100, 6)}%` }}
                >
                  <div className="flex size-8 items-center justify-center rounded-full bg-pasada-rust border-2 border-white shadow-md">
                    <Bus size={13} className="text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Info row */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-pasada-border mt-1">
              <div>
                <p className="text-[11px] text-pasada-muted">Route</p>
                <p className="text-sm font-bold text-pasada-dark">Lumban → Sta. Cruz</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-pasada-muted">Jeep at</p>
                <p className="text-sm font-bold text-pasada-dark">
                  {nearestJeep?.current_stop ?? "—"}
                </p>
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

          {/* Signal toggle button */}
          <button
            onClick={isWaiting ? onCancel : onWait}
            className={`w-full rounded-2xl py-4 text-base font-bold shadow-sm transition-colors ${
              isWaiting
                ? "bg-pasada-rust text-white hover:bg-pasada-rust/90"
                : "border-2 border-pasada-muted/40 bg-white/70 text-pasada-muted hover:border-pasada-rust hover:text-pasada-rust"
            }`}
          >
            {isWaiting ? `Waiting at ${selectedStop?.name ?? "…"}` : "Signal"}
          </button>
          {isWaiting && (
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-pasada-muted">Tap again to cancel · Driver sees your stop</p>
              <button
                onClick={onShowDetails}
                className="flex items-center gap-1 text-xs font-bold text-pasada-dark hover:text-pasada-rust transition-colors"
              >
                Details <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Map Tab ───────────────────────────────────────────────────────────────────

function MapTab({ nearestJeep, allJeeps = [], selectedStop, onSelectStop, userLocation, waitingCounts = {} }) {
  const [tappedStop,      setTappedStop]      = useState(null);
  const [searchQuery,     setSearchQuery]      = useState("");
  const [routeDirections, setRouteDirections]  = useState(null);
  const mapRef = useRef(null);

  // Fetch the real road route once using Directions API with all stops as waypoints
  useEffect(() => {
    if (!window.google?.maps || !MAPS_API_KEY) return;
    const waypoints = ROUTE_STOPS.slice(1, -1).map((s) => ({
      location: { lat: s.lat, lng: s.lng },
      stopover: true,
    }));
    new window.google.maps.DirectionsService().route(
      {
        origin:             { lat: ROUTE_STOPS[0].lat,                         lng: ROUTE_STOPS[0].lng },
        destination:        { lat: ROUTE_STOPS[ROUTE_STOPS.length - 1].lat,    lng: ROUTE_STOPS[ROUTE_STOPS.length - 1].lng },
        waypoints,
        optimizeWaypoints:  false,
        travelMode:         window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => { if (status === "OK") setRouteDirections(result); }
    );
  }, []);

  const filteredStops = searchQuery
    ? ROUTE_STOPS.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : ROUTE_STOPS;

  const jeepIcon = MAPS_API_KEY ? {
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
    fillColor: "#EF233C", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: 1.4,
    anchor: { x: 12, y: 22 },
  } : undefined;

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Floating search bar */}
      <div className="absolute top-0 inset-x-0 z-20 px-4 pt-10 pb-2">
        <div className="rounded-2xl bg-white/95 shadow-md border border-pasada-border px-4 py-2.5 flex items-center gap-2">
          <Search size={15} className="text-pasada-muted shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter stops…"
            className="flex-1 bg-transparent text-sm text-pasada-dark placeholder-pasada-muted outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}>
              <X size={14} className="text-pasada-muted" />
            </button>
          )}
        </div>
      </div>

      {/* Full-screen map */}
      {MAPS_API_KEY ? (
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={selectedStop ? { lat: selectedStop.lat, lng: selectedStop.lng } : DEFAULT_CENTER}
          zoom={13}
          options={MAP_OPTIONS}
          onLoad={(map) => { mapRef.current = map; }}
        >
          {/* Real road route from Directions API, fallback to demo polyline */}
          {routeDirections ? (
            <DirectionsRenderer
              directions={routeDirections}
              options={{
                suppressMarkers: true,
                polylineOptions: { strokeColor: "#EF233C", strokeWeight: 4, strokeOpacity: 0.7 },
              }}
            />
          ) : (
            <PolylineF
              path={DEMO_POLYLINE.map(([lat, lng]) => ({ lat, lng }))}
              options={{ strokeColor: "#EF233C", strokeWeight: 3, strokeOpacity: 0.55 }}
            />
          )}

          {/* Clickable stop markers — badge shows other passengers waiting there */}
          {filteredStops.map((stop) => (
            <PassengerStopMarker
              key={stop.id}
              stop={stop}
              isSelected={selectedStop?.id === stop.id}
              isTapped={tappedStop?.id === stop.id}
              waitingCount={waitingCounts[stop.name] ?? 0}
              onClick={() => {
                setTappedStop(stop);
                mapRef.current?.panTo({ lat: stop.lat, lng: stop.lng });
              }}
            />
          ))}

          {/* All active jeepney markers */}
          {allJeeps.map((jeep) => (
            <Marker
              key={jeep.uid ?? jeep.id}
              position={{ lat: jeep.lat, lng: jeep.lng }}
              icon={{
                ...jeepIcon,
                fillColor: jeep.uid === nearestJeep?.uid ? "#EF233C" : "#8D99AE",
                scale: jeep.uid === nearestJeep?.uid ? 1.4 : 1.1,
              }}
            />
          ))}

          {/* User location — person icon */}
          {userLocation && <PersonMarker position={userLocation} />}
        </GoogleMap>
      ) : (
        <div className="flex-1 h-full bg-[#edf2f4] flex items-center justify-center">
          <p className="text-pasada-warm text-sm text-center px-6">
            Add VITE_GOOGLE_MAPS_API_KEY to show map
          </p>
        </div>
      )}

      {/* Recenter on user GPS */}
      <RecenterButton onClick={() => userLocation && mapRef.current?.panTo(userLocation)} />

      {/* Tapped stop bottom panel */}
      {tappedStop && (
        <div className="absolute bottom-0 inset-x-0 z-20 px-4 pb-4">
          <div className="rounded-2xl bg-white border border-pasada-border shadow-xl p-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-pasada-rust/10 shrink-0">
              <MapPin size={18} className="text-pasada-rust" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-pasada-dark">{tappedStop.name}</p>
              <p className="text-xs text-pasada-muted">
                {selectedStop?.id === tappedStop.id ? "Current destination" : "Stop on Route 01"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setTappedStop(null)}
                className="flex size-8 items-center justify-center rounded-full bg-pasada-cream"
              >
                <X size={14} className="text-pasada-warm" />
              </button>
              {selectedStop?.id !== tappedStop.id && (
                <button
                  onClick={() => { onSelectStop(tappedStop); setTappedStop(null); }}
                  className="flex items-center gap-1.5 rounded-xl bg-pasada-rust px-3 py-2 text-xs font-bold text-white"
                >
                  Go here <ChevronRight size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stop marker with other-passengers-waiting badge ───────────────────────────

function PassengerStopMarker({ stop, isSelected, isTapped = false, waitingCount = 0, onClick }) {
  const hasWaiting = waitingCount > 0;
  const dotColor = isSelected ? "#EF233C" : isTapped ? "#2B2D42" : hasWaiting ? "#2563EB" : "#8D99AE";
  const dotSize = isSelected ? 18 : 14;

  return (
    <OverlayView
      position={{ lat: stop.lat, lng: stop.lng }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(w, h) => ({ x: -w / 2, y: -h / 2 })}
    >
      <div
        onClick={onClick}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
      >
        {/* Count badge — only shown when other passengers are waiting here */}
        {hasWaiting && (
          <div style={{
            background: "#2563EB",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "sans-serif",
            borderRadius: 99,
            padding: "1px 6px",
            marginBottom: 2,
            whiteSpace: "nowrap",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}>
            {waitingCount} waiting
          </div>
        )}
        <div style={{
          width: dotSize,
          height: dotSize,
          borderRadius: "50%",
          background: dotColor,
          border: "2px solid #fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }} />
      </div>
    </OverlayView>
  );
}

// ── Person Marker Overlay ─────────────────────────────────────────────────────

function PersonMarker({ position }) {
  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(w, h) => ({ x: -w / 2, y: -h / 2 })}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-[#2563eb] border-2 border-white shadow-lg">
        {/* person-standing stick figure */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="2" fill="white" stroke="none"/>
          <line x1="12" y1="7" x2="12" y2="15"/>
          <line x1="8.5" y1="10" x2="15.5" y2="10"/>
          <line x1="12" y1="15" x2="9" y2="21"/>
          <line x1="12" y1="15" x2="15" y2="21"/>
        </svg>
      </div>
    </OverlayView>
  );
}

// ── Recenter Button ───────────────────────────────────────────────────────────

function RecenterButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-6 right-4 z-10 flex size-12 items-center justify-center rounded-full bg-white shadow-lg border border-pasada-border hover:shadow-xl transition-shadow"
    >
      <LocateFixed size={20} className="text-pasada-dark" />
    </button>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab({ user, onLogout }) {
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Passenger";
  const initial     = displayName[0]?.toUpperCase() ?? "P";
  const joinedDate  = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-PH", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="flex-1 overflow-y-auto bg-pasada-cream">
      <div className="bg-white border-b border-pasada-border px-5 pt-10 pb-5">
        <div className="flex items-center gap-4">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={displayName}
              className="size-14 rounded-full object-cover ring-2 ring-pasada-rust/20"
            />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-full bg-pasada-rust text-2xl font-black text-white">
              {initial}
            </div>
          )}
          <div>
            <p className="text-lg font-bold text-pasada-dark">{displayName}</p>
            <p className="text-sm text-pasada-muted">{user?.email ?? "Passenger"}</p>
            {joinedDate && (
              <p className="text-xs text-pasada-muted/60 mt-0.5">Member since {joinedDate}</p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Account info */}
        <div className="rounded-2xl bg-white border border-pasada-border divide-y divide-pasada-border">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-pasada-muted">Route</span>
            <span className="text-sm font-semibold text-pasada-dark">Lumban → Sta. Cruz</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-pasada-muted">Sign-in method</span>
            <span className="text-sm font-semibold text-pasada-dark">
              {user?.providerData?.[0]?.providerId === "google.com" ? "Google" : "Email"}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-pasada-muted">Account ID</span>
            <span className="text-xs font-mono text-pasada-muted truncate max-w-[140px]">
              {user?.uid?.slice(0, 12) ?? "—"}…
            </span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-pasada-border bg-white py-3.5 text-sm font-bold text-pasada-warm hover:bg-pasada-cream transition-colors"
        >
          <LogOut size={16} />
          Sign Out
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
