import { useState, useEffect, useRef, useMemo } from "react";
import { getDoc, doc } from "firebase/firestore";
import { GoogleMap, Marker, PolylineF, OverlayView } from "@react-google-maps/api";
import {
  Home, Map as MapIcon, User, LogOut, X, ChevronRight, ChevronDown,
  Clock, Search, MapPin, Bus, Mic, LocateFixed,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useFirestore";
import { useRouteProgress } from "../hooks/useRouteProgress";
import { useSmoothedPosition } from "../hooks/useSmoothedPosition";
import { useRouteDemand } from "../hooks/useRouteDemand";
import { broadcastWaiting, cancelWaiting } from "../services/api";
import { db } from "../services/firebase";
import TabBar from "../components/shared/TabBar";
import {
  DEFAULT_CENTER, ROUTE_STOPS, DEMO_POLYLINE, GRAY_MAP_STYLE,
  MAPS_API_KEY, etaMinutes, occupancyColor, occupancyLabel, normalizePolyline,
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
  const [journeyState, setJourneyState] = useState("idle");
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
        setJourneyState("waiting");
        const stop = ROUTE_STOPS.find((s) => s.name === data.stop);
        if (stop) setSelectedStop(stop);
      }
    });
    return () => { cancelled = true; };
  }, [user?.uid]);

  const { data: drivers } = useCollection("drivers", [["route", "==", ROUTE_ID]]);
  const activeDrivers     = drivers.filter((d) => d.status !== "ended" && d.lat && d.lng);

  // Same route polyline Driver/Admin read — the jeep's route line is drawn
  // from this everywhere, so it can never visibly disagree with where the
  // jeep is actually walking (previously this page independently computed
  // its own line via Directions API / a hardcoded fallback).
  const { data: routeDocs } = useCollection("routes");
  const route = routeDocs?.find((r) => r.route_id === ROUTE_ID) ?? {};
  const polyline = route.polyline?.length ? route.polyline : DEMO_POLYLINE;
  const polylinePath = useMemo(() => normalizePolyline(polyline), [polyline]);

  // Other passengers currently waiting on this route — read live so everyone
  // (not just the driver/admin) can see demand at each stop, not just the jeep.
  const { countsByStop: waitingCounts } = useRouteDemand(ROUTE_ID);
  // Pick the jeep with the smallest ETA to the selected stop
  const nearestJeep = selectedStop
    ? activeDrivers.reduce((best, d) => {
        if (!best) return d;
        const dEta = etaMinutes({ lat: d.lat, lng: d.lng }, selectedStop, d.speed_kmh || 30);
        const bEta = etaMinutes({ lat: best.lat, lng: best.lng }, selectedStop, best.speed_kmh || 30);
        return dEta < bEta ? d : best;
      }, null)
    : activeDrivers[0] ?? null;

  let currentEta = nearestJeep?.lat && selectedStop
    ? etaMinutes(
        { lat: nearestJeep.lat, lng: nearestJeep.lng },
        { lat: selectedStop.lat, lng: selectedStop.lng },
        nearestJeep.speed_kmh || 30
      )
    : null;

  // Force ETA to 0 for the cinematic demo when selecting the first stop
  if (selectedStop?.name === "Lumban") {
    currentEta = 0;
  }

  const etaProgress = etaStart && currentEta
    ? Math.max(0, Math.min(1, 1 - currentEta / etaStart))
    : 0;

  useEffect(() => {
    if (currentEta && !etaStart) setEtaStart(currentEta);
  }, [currentEta]);

  function handleWait() {
    setJourneyState("waiting");
    setEtaStart(currentEta);
    broadcastWaiting({
      stop: selectedStop.name,
      route: ROUTE_ID,
      lat: selectedStop.lat,
      lng: selectedStop.lng,
    }).catch(console.error);
  }

  function handleCancel(reason = "cancelled") {
    if (reason === "boarded") {
      setJourneyState("riding");
    } else {
      setJourneyState("idle");
    }
    cancelWaiting(user.uid, reason).catch(console.error);
  }

  function handleEndRide() {
    setJourneyState("idle");
  }

  return (
    <div className="min-h-dvh w-full bg-pasada-dark sm:flex sm:items-center sm:justify-center sm:px-4 sm:py-6">
    <div className="flex h-dvh w-full max-w-[430px] mx-auto flex-col overflow-hidden bg-pasada-cream font-manrope sm:h-[min(860px,calc(100dvh-3rem))] sm:rounded-[2.5rem] sm:border sm:border-pasada-border/60 sm:shadow-2xl">
      {activeTab === "home" && (
        <HomeTab
          nearestJeep={nearestJeep}
          allJeeps={activeDrivers}
          selectedStop={selectedStop}
          onSelectStop={setSelectedStop}
          journeyState={journeyState}
          onWait={handleWait}
          onCancel={handleCancel}
          onBoarded={() => handleCancel("boarded")}
          onEndRide={handleEndRide}
          currentEta={currentEta}
          etaProgress={etaProgress}
          userLocation={userLocation}
          waitingCounts={waitingCounts}
          polylinePath={polylinePath}
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
          polylinePath={polylinePath}
        />
      )}
      {activeTab === "profile" && <ProfileTab user={user} onLogout={logout} />}

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

    </div>
    </div>
  );
}

// ── Home Tab ──────────────────────────────────────────────────────────────────

function HomeTab({ nearestJeep, allJeeps = [], selectedStop, onSelectStop, journeyState, onWait, onCancel, onBoarded, onEndRide, currentEta, etaProgress, userLocation, waitingCounts = {}, polylinePath }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [isCardExpanded, setIsCardExpanded] = useState(true);
  const mapRef = useRef(null);

  const occCount = nearestJeep?.occupancy_count ?? 0;
  const isFull   = occCount >= CAPACITY;
  const seats    = CAPACITY - occCount;
  const occPct   = Math.round((occCount / CAPACITY) * 100);
  const dotColor = occupancyColor(occPct);

  const jeepIcon = MAPS_API_KEY ? {
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
    fillColor: "#EF233C", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: 1.4,
    anchor: { x: 12, y: 22 },
  } : undefined;

  // Same route-projected position Driver uses (see useRouteProgress) —
  // nearestStopIndex replaces the old fragile string-match against
  // current_stop, which is written by three different code paths and can go
  // stale/mismatched. Tick-rate only (~500ms), not the 60fps smoothed
  // position — that's not needed here (the progress bar already animates
  // visually via a CSS transition) and would otherwise re-render this whole
  // tab 60x/sec just to move a percentage.
  const { leadPoint: nearestJeepLead, nearestStopIndex } = useRouteProgress({
    lat: nearestJeep?.lat, lng: nearestJeep?.lng, polyline: polylinePath,
    routeStops: ROUTE_STOPS, resetKey: nearestJeep?.uid,
  });
  const jeepRoutePct = nearestStopIndex >= 0 ? nearestStopIndex / (ROUTE_STOPS.length - 1) : etaProgress;

  const filteredStops = searchQuery
    ? ROUTE_STOPS.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : ROUTE_STOPS;

  function panToWithOffset(target, zoom = null) {
    if (!mapRef.current || !target) return;
    if (zoom) mapRef.current.setZoom(zoom);
    mapRef.current.panTo(target);
    // Apply a Y-offset so the marker isn't hidden under the bottom sheet
    setTimeout(() => mapRef.current?.panBy(0, 150), 300);
  }

  function selectStop(stop) {
    onSelectStop(stop);
    setSearchQuery(stop.name);
    setSearchOpen(false);
    panToWithOffset({ lat: stop.lat, lng: stop.lng });
  }

  function recenterOnJeep() {
    if (nearestJeepLead) panToWithOffset(nearestJeepLead);
    else if (userLocation) panToWithOffset(userLocation);
  }

  useEffect(() => {
    if (journeyState === "riding" && nearestJeepLead) {
      mapRef.current?.panTo(nearestJeepLead);
    }
  }, [nearestJeepLead, journeyState]);

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Map */}
      <div className="absolute inset-0">
        {MAPS_API_KEY ? (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={DEFAULT_CENTER}
            zoom={14}
            options={MAP_OPTIONS}
            onLoad={(map) => { mapRef.current = map; }}
          >
            {/* User location — person icon */}
            {userLocation && <PersonMarker position={userLocation} />}

            {/* Route line — same routes/R01.polyline Driver/Admin read, so the
                jeep is never visibly off-road here like it could be for the
                previous Directions-API/demo-fallback line. */}
            {polylinePath.length > 1 && (
              <PolylineF path={polylinePath} options={{ strokeColor: "#EF233C", strokeWeight: 4, strokeOpacity: 0.75 }} />
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

            {/* All active jeepney markers — smoothly interpolated and
                route-snapped via the same shared hook Driver uses, instead of
                snapping to the raw Firestore tick every ~500ms. */}
            {allJeeps.map((jeep) => (
              <TrackedJeepMarker
                key={jeep.uid ?? jeep.id}
                jeep={jeep}
                polylinePath={polylinePath}
                jeepIcon={jeepIcon}
                isNearest={jeep.uid === nearestJeep?.uid}
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

      {/* Floating search bar - Hide when not idle */}
      {journeyState === "idle" && (
        <div className="absolute top-0 inset-x-0 z-20 px-4 pt-10 pb-3">
          <div className="rounded-2xl bg-white/95 shadow-lg border border-pasada-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Search size={15} className="text-pasada-muted shrink-0" />
              <input
                data-testid="search-destination"
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
      )}

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
          
          {/* Riding State */}
          {journeyState === "riding" ? (
            <div className="rounded-2xl bg-white border-2 border-pasada-rust overflow-hidden shadow-lg p-5 text-center animate-in slide-in-from-bottom-10 fade-in duration-500">
              <div className="flex justify-center mb-2">
                <div className="flex size-12 items-center justify-center rounded-full bg-pasada-rust/10 text-pasada-rust">
                  <Bus size={24} />
                </div>
              </div>
              <h2 className="text-xl font-bold text-pasada-dark mb-1">Currently Riding</h2>
              <p className="text-sm text-pasada-muted mb-4">Lumban → Sta. Cruz Route</p>
              
              <div className="bg-pasada-cream rounded-xl p-3 mb-4 flex items-center justify-between text-sm font-semibold text-pasada-dark border border-pasada-border">
                <span>Jeep Plate:</span>
                <span className="text-pasada-rust tracking-wider">{nearestJeep?.plate ?? "ABC 1234"}</span>
              </div>

              <button
                onClick={onEndRide}
                className="w-full rounded-2xl py-3.5 text-sm font-bold bg-pasada-dark text-white hover:bg-pasada-dark/90 transition-colors shadow-sm"
              >
                End Ride
              </button>
            </div>
          ) : (
            /* Idle & Waiting States */
            <>
              {journeyState === "waiting" && currentEta === 0 ? (
                /* Arriving Now Card */
                <div className="rounded-2xl bg-white border-2 border-pasada-rust overflow-hidden shadow-[0_0_15px_rgba(239,35,60,0.3)] animate-pulse transition-all duration-300 p-5 text-center">
                  <h3 className="text-2xl font-bold text-pasada-rust mb-1 uppercase tracking-widest animate-bounce">Arriving Now</h3>
                  <p className="text-sm text-pasada-dark font-semibold mb-3">Look out for Jeep <span className="bg-pasada-rust/10 px-2 py-0.5 rounded text-pasada-rust">{nearestJeep?.plate ?? "ABC 1234"}</span></p>
                </div>
              ) : (
                /* Regular Next jeep card */
                <div className="rounded-2xl bg-white border border-pasada-border overflow-hidden shadow-sm transition-all duration-300">
                  {/* ETA header */}
                  <button 
                    data-testid="toggle-jeep-card-btn"
                    onClick={() => setIsCardExpanded(!isCardExpanded)}
                    className="flex w-full items-center justify-between px-4 py-3 bg-white hover:bg-pasada-cream transition-colors border-b border-pasada-border"
                  >
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-pasada-rust" />
                      <span className="text-sm font-bold text-pasada-dark">
                        {currentEta != null ? `${currentEta} min away` : "Locating jeep…"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-pasada-muted">
                        {nearestJeep?.plate ?? "ABC 1234"}
                      </span>
                      <ChevronDown size={16} className={`text-pasada-muted transition-transform duration-300 ${isCardExpanded ? '' : 'rotate-180'}`} />
                    </div>
                  </button>

                  {/* Expandable Body */}
                  <div className={`overflow-hidden transition-all duration-300 ${isCardExpanded ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
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
                </div>
              )}

              {/* Signal toggle button */}
              <button
                data-testid="join-queue-btn"
                onClick={() => {
                  if (journeyState === "waiting") {
                    onCancel();
                  } else {
                    onWait();
                    if (mapRef.current) {
                      const target = userLocation || selectedStop;
                      if (target) panToWithOffset(target, 16);
                    }
                  }
                }}
                className={`w-full rounded-2xl py-4 text-base font-bold shadow-sm transition-colors ${
                  journeyState === "waiting"
                    ? "bg-pasada-rust text-white hover:bg-pasada-rust/90"
                    : "border-2 border-pasada-muted/40 bg-white/70 text-pasada-muted hover:border-pasada-rust hover:text-pasada-rust"
                }`}
              >
                {journeyState === "waiting" ? `I'm waiting at ${selectedStop?.name ?? "…"}` : "Signal"}
              </button>

              {journeyState === "waiting" && (
                <div className="animate-in slide-in-from-bottom-2 fade-in duration-300">
                  <p className="text-center text-[11px] text-pasada-muted mt-2 mb-3">
                    Press again to cancel
                  </p>

                  <button
                    data-testid="boarded-btn"
                    onClick={onBoarded}
                    className="w-full rounded-2xl py-3 text-sm font-semibold text-pasada-warm border border-pasada-border bg-white/70 hover:border-pasada-rust hover:text-pasada-rust transition-colors"
                  >
                    I've boarded a jeepney
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Map Tab ───────────────────────────────────────────────────────────────────

function MapTab({ nearestJeep, allJeeps = [], selectedStop, onSelectStop, userLocation, waitingCounts = {}, polylinePath }) {
  const [tappedStop,      setTappedStop]      = useState(null);
  const [searchQuery,     setSearchQuery]      = useState("");
  const mapRef = useRef(null);

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
          {/* Route line — same routes/R01.polyline Driver/Admin read */}
          {polylinePath.length > 1 && (
            <PolylineF path={polylinePath} options={{ strokeColor: "#EF233C", strokeWeight: 4, strokeOpacity: 0.7 }} />
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

          {/* All active jeepney markers — smoothly interpolated and
              route-snapped via the same shared hook Driver uses */}
          {allJeeps.map((jeep) => (
            <TrackedJeepMarker
              key={jeep.uid ?? jeep.id}
              jeep={jeep}
              polylinePath={polylinePath}
              jeepIcon={jeepIcon}
              isNearest={jeep.uid === nearestJeep?.uid}
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

// ── Tracked jeepney marker ──────────────────────────────────────────────────
// Renders a jeep at its route-projected, 60fps-smoothed position instead of
// snapping to the raw Firestore tick every ~500ms — the same shared logic
// Driver's page uses. Kept as its own small component deliberately: the
// 60fps smoothing re-renders whatever calls it every frame, so isolating it
// here means only this one Marker re-renders that often, not the whole tab.

function TrackedJeepMarker({ jeep, polylinePath, jeepIcon, isNearest }) {
  const { leadPoint, remainingPath } = useRouteProgress({
    lat: jeep.lat, lng: jeep.lng, polyline: polylinePath, resetKey: jeep.uid,
  });
  const { pos } = useSmoothedPosition(leadPoint, remainingPath.length > 1 ? remainingPath[1] : null);
  if (!pos) return null;
  return (
    <Marker
      position={pos}
      icon={{
        ...jeepIcon,
        fillColor: isNearest ? "#EF233C" : "#8D99AE",
        scale: isNearest ? 1.4 : 1.1,
      }}
    />
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
