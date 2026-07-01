import { useState, useEffect, useRef, useMemo } from "react";
import { GoogleMap, OverlayView, PolylineF, CircleF } from "@react-google-maps/api";
import {
  Home, Navigation, DollarSign, MoreHorizontal,
  MapPin, Gauge, Users, Zap, ChevronRight, LogOut,
  Clock, Bus, LocateFixed,
} from "lucide-react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useFirestore";
import { getDepartureScore } from "../services/api";
import { db } from "../services/firebase";
import TabBar from "../components/shared/TabBar";
import DepartureScore from "../components/driver/DepartureScore";
import OccupancyModal from "../components/driver/OccupancyModal";
import EndTripModal from "../components/driver/EndTripModal";
import { startSim, stopSim } from "../services/sim";
import {
  DEFAULT_CENTER, DEMO_POLYLINE, MAPS_API_KEY, GRAY_MAP_STYLE, ROUTE_STOPS, occupancyColor,
  bearing, normalizePolyline, DEMAND_TIERS, demandTier, DEMAND_CIRCLE_RADIUS_M, DEMAND_CIRCLE_OPACITY,
} from "../services/maps";
import { useRouteProgress } from "../hooks/useRouteProgress";
import { useSmoothedPosition } from "../hooks/useSmoothedPosition";
import { useRouteDemand } from "../hooks/useRouteDemand";

const CAPACITY = 18;
const ROUTE_ID = "R01";

const TABS = [
  { id: "home",     label: "HOME",     icon: Home           },
  { id: "trips",    label: "TRIPS",    icon: Navigation     },
  { id: "earnings", label: "EARNINGS", icon: DollarSign     },
  { id: "more",     label: "MORE",     icon: MoreHorizontal },
];

const MAP_OPTIONS = {
  disableDefaultUI: true,
  rotateControl: false,
  styles: GRAY_MAP_STYLE,
};

// Stable object reference — recreating this on every render was making
// GoogleMap's center-sync effect re-fire and fight the imperative follow pan.
const INITIAL_CENTER = { lat: ROUTE_STOPS[0].lat, lng: ROUTE_STOPS[0].lng };

export default function DriverPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("home");
  const [showModal, setShowModal] = useState(false);
  const [showEndSummary, setShowEndSummary] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreUnavailable, setScoreUnavailable] = useState(false);
  const mapRef = useRef(null);

  const { data: driverDocs } = useCollection("drivers", [["uid", "==", user?.uid ?? "__none__"]]);
  const driver = driverDocs?.[0] ?? {};
  const tripActive = driver.status === "in_transit";

  // Single shared source of truth for "how many passengers are waiting where" —
  // reads the live passengers collection rather than the denormalized
  // stops.count field, which can drift stale (cancel-waiting never decrements it).
  const { countsByStop, totalWaiting } = useRouteDemand(ROUTE_ID);

  const { data: routeDocs } = useCollection("routes");
  const route = routeDocs?.find((r) => r.route_id === ROUTE_ID) ?? {};
  const polyline = route.polyline?.length ? route.polyline : DEMO_POLYLINE;

  useEffect(() => {
    if (!user?.uid) return;
    // Only write structural fields — driver_name/plate come from the seeded Firestore doc
    setDoc(
      doc(db, "drivers", user.uid),
      {
        uid: user.uid,
        route: ROUTE_ID,
        capacity: CAPACITY,
      },
      { merge: true }
    ).catch(console.error);
  }, [user?.uid]);

  const mapCenter =
    driver.lat && driver.lng
      ? { lat: driver.lat, lng: driver.lng }
      : DEFAULT_CENTER;

  // The map div is display:none (not unmounted) while on another tab, which can
  // leave Google Maps' internal size stale — nudge it to re-measure on return.
  useEffect(() => {
    if (activeTab === "home" && mapRef.current && window.google?.maps) {
      window.google.maps.event.trigger(mapRef.current, "resize");
    }
  }, [activeTab]);

  const occCount = driver.occupancy_count ?? 0;
  const occPct   = Math.round((occCount / CAPACITY) * 100);
  const occHex   = occupancyColor(occPct);

  function handleStartTrip() {
    setDoc(
      doc(db, "drivers", user.uid),
      {
        status: "in_transit",
        lat: ROUTE_STOPS[0].lat,
        lng: ROUTE_STOPS[0].lng,
        current_stop: ROUTE_STOPS[0].name,
        last_updated: serverTimestamp(),
      },
      { merge: true }
    ).catch(console.error);
    // Orient map toward the start of the route
    if (mapRef.current && polyline.length >= 2) {
      const h = bearing(polyline[0], polyline[1]);
      mapRef.current.setHeading(h);
      mapRef.current.setZoom(15);
      mapRef.current.panTo({ lat: ROUTE_STOPS[0].lat, lng: ROUTE_STOPS[0].lng });
    }
    startSim(user.uid, polyline, 50);
  }

  function handleEndTrip() {
    stopSim(user.uid);
    setShowEndSummary(true);
    setDoc(
      doc(db, "drivers", user.uid),
      { status: "idle", speed_kmh: 0, last_updated: serverTimestamp() },
      { merge: true }
    ).catch(console.error);
  }

  function handleSaveOccupancy(count) {
    const quickLevels = [
      { pct: 0 }, { pct: 0.25 }, { pct: 0.5 }, { pct: 0.75 }
    ];
    const exactQuickLevel = quickLevels.find(q => Math.round(CAPACITY * q.pct) === count);
    const pct = exactQuickLevel ? Math.round(exactQuickLevel.pct * 100) : Math.round((count / CAPACITY) * 100);

    setShowModal(false);
    setDoc(
      doc(db, "drivers", user.uid),
      { occupancy_count: count, occupancy_pct: pct, last_updated: serverTimestamp() },
      { merge: true }
    ).catch(console.error);
  }

  async function fetchScore() {
    setScoreLoading(true);
    setScoreUnavailable(false);
    try {
      const res = await getDepartureScore(user.uid);
      setScoreData(res.data);
    } catch (e) {
      console.error("Departure score unavailable:", e.message);
      setScoreUnavailable(true);
    } finally {
      setScoreLoading(false);
    }
  }

  return (
    <div className="flex h-screen max-w-[430px] mx-auto flex-col overflow-hidden bg-pasada-cream font-manrope">
      {/* Stays mounted across tab switches (display:none, not unmounted) —
          destroying/recreating the GoogleMap + jeep marker every time you left
          Home was resetting the camera and racing the map's async re-init,
          which is how the jeep marker was ending up missing on return. */}
      <div className={activeTab === "home" ? "flex flex-1 flex-col overflow-hidden" : "hidden"}>
        <MapHomeTab
          driver={driver}
          mapCenter={mapCenter}
          mapRef={mapRef}
          polyline={polyline}
          tripActive={tripActive}
          totalWaiting={totalWaiting}
          countsByStop={countsByStop}
          occCount={occCount}
          occHex={occHex}
          route={route}
          scoreData={scoreData}
          scoreLoading={scoreLoading}
          scoreUnavailable={scoreUnavailable}
          onFetchScore={fetchScore}
          onStartTrip={handleStartTrip}
          onEndTrip={handleEndTrip}
          onOpenModal={() => setShowModal(true)}
        />
      </div>
      {activeTab === "trips"    && <TripsTab />}
      {activeTab === "earnings" && <EarningsTab />}
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

      {showEndSummary && (
        <EndTripModal
          earnings="1,450"
          passengers="42"
          tip="High demand at terminal. Proceed to bay 3."
          onClose={() => setShowEndSummary(false)}
        />
      )}
    </div>
  );
}

// ── Animated jeepney marker ───────────────────────────────────────────────────
// Stable offset — defined at module scope so it never triggers unnecessary re-renders.
// Anchored at the icon's true visual center, matching the SVG's default
// `transformOrigin: "50% 50%"` below — rotation pivots around the exact point
// pinned to the map. Now that the route line itself is trimmed to start right
// at this same point (see useRouteProgress), a center anchor is what makes the
// jeep read as tracing the line directly rather than offset above/beside it.
const JEEP_PIXEL_OFFSET = (w, h) => ({ x: -(w / 2), y: -(h / 2) });

/**
 * Owns the 60fps position/heading tween itself (via useSmoothedPosition),
 * kept as a small leaf component deliberately — MapHomeTab only calls the
 * tick-rate `useRouteProgress` (once per ~500ms), so the frame-by-frame
 * re-renders needed to animate this marker stay isolated to just this
 * component instead of re-rendering the whole page (status cards, bottom
 * overlay, etc.) 60 times a second.
 */
function AnimatedJeepMarker({ leadPoint, nextPoint }) {
  const { pos, heading } = useSmoothedPosition(leadPoint, nextPoint);
  return (
    <OverlayView
      position={pos}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={JEEP_PIXEL_OFFSET}
    >
      <JeepneyMarker heading={heading} />
    </OverlayView>
  );
}

// ── Stop marker with passenger count badge ────────────────────────────────────

function StopMarker({ name, count }) {
  const hasWaiting = count > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
      {/* Count badge — only shown when passengers are waiting */}
      {hasWaiting && (
        <div style={{
          background: "#EF233C",
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          fontFamily: "sans-serif",
          borderRadius: 99,
          padding: "1px 5px",
          marginBottom: 2,
          whiteSpace: "nowrap",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}>
          {count} waiting
        </div>
      )}
      {/* Dot */}
      <div style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: hasWaiting ? "#EF233C" : "#8D99AE",
        border: "2px solid #fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </div>
  );
}

// ── Philippine Jeepney SVG marker (fixed screen size, zoom-independent) ──────

function JeepneyMarker({ heading = 0 }) {
  // The SVG is drawn nose-left (grill/headlights at x=2-18, taillights at x=64-78),
  // i.e. its resting orientation already points west (compass 270°). Rotate by
  // (heading + 90) so a 0° (north) heading turns it to face up, 90° (east) right, etc.
  const rotateDeg = (heading + 90) % 360;
  return (
    // position:relative is only here so zIndex takes effect (it's a no-op on
    // static-positioned elements) — this keeps the vehicle above the trimmed
    // route polyline where their leading edges meet. Rotation pivots around
    // the SVG's own center (default transformOrigin), matching JEEP_PIXEL_OFFSET
    // below, which anchors that same center point exactly on the line.
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 48" width="30" height="18" style={{ position: "relative", zIndex: 10, display: "block", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))", transform: `rotate(${rotateDeg}deg)`, transformOrigin: "50% 50%", transition: "transform 300ms ease" }}>
      {/* ── Ground shadow ── */}
      <ellipse cx="40" cy="46" rx="32" ry="3" fill="rgba(0,0,0,0.18)" />

      {/* ── Roof crown / raised top (characteristic jeepney silhouette) ── */}
      <rect x="18" y="3" width="48" height="8" rx="2" fill="#8B3515" />
      <rect x="18" y="3" width="48" height="2" rx="1" fill="#FFD700" />
      {/* Roof vents */}
      <rect x="25" y="4" width="5" height="4" rx="1" fill="#6B2810" />
      <rect x="33" y="4" width="5" height="4" rx="1" fill="#6B2810" />
      <rect x="41" y="4" width="5" height="4" rx="1" fill="#6B2810" />
      <rect x="49" y="4" width="5" height="4" rx="1" fill="#6B2810" />
      {/* Hood ornament */}
      <line x1="10" y1="10" x2="10" y2="5" stroke="#E0E0E0" strokeWidth="1.2" />
      <polygon points="10,3 8.5,6 11.5,6" fill="#FFD700" />

      {/* ── Main body ── */}
      <rect x="2" y="10" width="76" height="24" rx="2" fill="#EF233C" />

      {/* ── Chrome front grill (iconic horizontal bars) ── */}
      <rect x="2" y="10" width="16" height="24" rx="2" fill="#9E3D10" />
      <rect x="2" y="14" width="16" height="2"  fill="#D4D4D4" />
      <rect x="2" y="18" width="16" height="2"  fill="#D4D4D4" />
      <rect x="2" y="22" width="16" height="2"  fill="#D4D4D4" />
      <rect x="2" y="26" width="16" height="2"  fill="#D4D4D4" />
      {/* Windshield */}
      <rect x="3" y="11" width="13" height="12" rx="1" fill="#B8E0F0" opacity="0.85" />
      {/* Chrome grill frame */}
      <rect x="2" y="10" width="16" height="1.5" fill="#E8E8E8" />

      {/* ── Headlights ── */}
      <rect x="2" y="13" width="2" height="5" rx="1" fill="#FFFDE7" />
      <rect x="2" y="20" width="2" height="3" rx="1" fill="#FFFDE7" opacity="0.5" />

      {/* ── Side windows ── */}
      <rect x="20" y="12" width="12" height="11" rx="1.5" fill="#B8E0F0" opacity="0.8" />
      <rect x="34" y="12" width="12" height="11" rx="1.5" fill="#B8E0F0" opacity="0.8" />
      <rect x="48" y="12" width="12" height="11" rx="1.5" fill="#B8E0F0" opacity="0.8" />

      {/* ── Colorful side art strips (typical jeepney decoration) ── */}
      <rect x="20" y="24" width="12" height="4" fill="#E53935" />
      <rect x="34" y="24" width="12" height="4" fill="#1565C0" />
      <rect x="48" y="24" width="12" height="4" fill="#E53935" />

      {/* ── Gold chrome accent stripe ── */}
      <rect x="2" y="28" width="76" height="3" fill="#FFD700" />
      <rect x="2" y="10" width="76" height="1.5" fill="#FFD700" opacity="0.6" />

      {/* ── Open rear (jeepneys load from the back) ── */}
      <rect x="64" y="11" width="14" height="20" rx="1" fill="#7a2e08" opacity="0.7" />
      <rect x="65" y="12" width="12" height="10" rx="1" fill="#5a1f04" opacity="0.5" />
      {/* Taillights */}
      <rect x="76" y="14" width="2" height="5" rx="1" fill="#EF5350" />
      <rect x="76" y="22" width="2" height="3" rx="1" fill="#EF9A9A" />
      {/* Rear chrome bumper */}
      <rect x="66" y="30" width="12" height="2.5" rx="1" fill="#E0E0E0" />

      {/* ── Front chrome bumper ── */}
      <rect x="2" y="30" width="16" height="2.5" rx="1" fill="#E0E0E0" />

      {/* ── Wheels ── */}
      <circle cx="20" cy="38" r="7.5" fill="#1a1a1a" />
      <circle cx="20" cy="38" r="5"   fill="#2C3E50" />
      <circle cx="20" cy="38" r="2.5" fill="#95A5A6" />
      <circle cx="20" cy="38" r="1"   fill="#BDC3C7" />

      <circle cx="56" cy="38" r="7.5" fill="#1a1a1a" />
      <circle cx="56" cy="38" r="5"   fill="#2C3E50" />
      <circle cx="56" cy="38" r="2.5" fill="#95A5A6" />
      <circle cx="56" cy="38" r="1"   fill="#BDC3C7" />
    </svg>
  );
}

// ── Map Home Tab (always shows map) ───────────────────────────────────────────

function MapHomeTab({ driver, mapCenter, mapRef, polyline, tripActive, totalWaiting, countsByStop, occCount, occHex, route, scoreData, scoreLoading, scoreUnavailable, onFetchScore, onStartTrip, onEndTrip, onOpenModal }) {
  const [isFollowing, setIsFollowing] = useState(true);
  const isFollowingRef = useRef(true);
  useEffect(() => { isFollowingRef.current = isFollowing; }, [isFollowing]);

  // Auto-follow resumes whenever a new trip starts.
  useEffect(() => {
    if (tripActive) setIsFollowing(true);
  }, [tripActive]);

  // Auto-fetch departure score on mount and whenever a trip ends. Depends on
  // tripActive (not []) because MapHomeTab now stays mounted across tab
  // switches — it used to remount every time you came back to Home, which is
  // what refreshed this; without the dependency it would only ever fire once.
  useEffect(() => {
    if (!tripActive) onFetchScore();
  }, [tripActive]);

  const polylinePath = useMemo(() => normalizePolyline(polyline), [polyline]);

  // remainingPath is the route trimmed to what's still ahead of the jeep —
  // the traveled portion behind it is never drawn. Shared with Passenger/Admin
  // (see useRouteProgress) so all three pages trim/track identically instead
  // of three independent treatments of it. Tick-rate only (~500ms) — the
  // 60fps smoothing lives inside AnimatedJeepMarker itself, so this whole
  // page (status cards, bottom overlay) doesn't re-render every frame just
  // to move the marker.
  const { leadPoint, remainingPath, segmentIndex } = useRouteProgress({
    lat: driver.lat, lng: driver.lng, polyline: polylinePath, resetKey: tripActive,
  });

  // Camera follow: pan once per tick (leadPoint only changes once per
  // Firestore tick, not every rAF frame) via the map's own animated panTo.
  // Calling setCenter 60x/sec was fighting the browser's own zoom/scroll-wheel
  // handling, which is what made zooming feel jittery.
  useEffect(() => {
    if (leadPoint && isFollowingRef.current && mapRef.current) mapRef.current.panTo(leadPoint);
  }, [leadPoint]);

  const polylineOptions = useMemo(
    () => ({ strokeColor: "#EF233C", strokeWeight: 5, strokeOpacity: tripActive ? 1 : 0.4, zIndex: 1 }),
    [tripActive]
  );

  // Memoized on `countsByStop` alone so a driver-position tick (every 500ms)
  // never forces the heatmap circles to be rebuilt — only real demand changes
  // do. Positioned via ROUTE_STOPS (not the stops Firestore collection) so
  // Driver/Passenger/Admin all place these circles identically.
  const demandCircles = useMemo(
    () =>
      ROUTE_STOPS
        .filter((s) => (countsByStop[s.name] ?? 0) > 0)
        .map((s) => {
          const tier = demandTier(countsByStop[s.name]);
          return (
            <CircleF
              key={s.id}
              center={{ lat: s.lat, lng: s.lng }}
              radius={DEMAND_CIRCLE_RADIUS_M}
              options={{ strokeWeight: 0, fillColor: tier.color, fillOpacity: DEMAND_CIRCLE_OPACITY }}
            />
          );
        }),
    [countsByStop]
  );

  function handleMapLoad(map) {
    mapRef.current = map;
    // Native event — fires only on user-initiated drag, never on programmatic panTo/setCenter.
    map.addListener("dragstart", () => setIsFollowing(false));
  }

  function handleRecenter() {
    setIsFollowing(true);
    if (driver.lat && driver.lng) mapRef.current?.panTo({ lat: driver.lat, lng: driver.lng });
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        {MAPS_API_KEY ? (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={INITIAL_CENTER}
            zoom={14}
            options={MAP_OPTIONS}
            onLoad={handleMapLoad}
          >
            {/* Route polyline — trimmed to the path still ahead of the jeep;
                the traveled portion behind it is not drawn. Keyed on
                segmentIndex (not path length) so it only remounts when the
                jeep actually crosses into a new segment, not on every tick. */}
            {remainingPath.length > 1 && (
              <PolylineF key={segmentIndex} path={remainingPath} options={polylineOptions} />
            )}

            {/* Density heatmap — one fixed-size circle per stop, color-coded by tier */}
            {demandCircles}

            {/* Jeepney marker — smoothly interpolated at 60fps, centered exactly
                on the leading edge of remainingPath (see useRouteProgress) */}
            {leadPoint && (
              <AnimatedJeepMarker
                leadPoint={leadPoint}
                nextPoint={remainingPath.length > 1 ? remainingPath[1] : null}
              />
            )}
          </GoogleMap>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-pasada-cream">
            <p className="text-pasada-warm text-sm text-center px-6">
              Add VITE_GOOGLE_MAPS_API_KEY to .env to show map
            </p>
          </div>
        )}
      </div>

      {/* Recenter — appears only once the driver has dragged away from auto-follow.
          Sits level with the Route label, in the overlay's transparent gradient
          zone (above the opaque stat/action cards), so it's never buried under
          the bottom panel's content regardless of which optional cards (demand
          chip, confidence card) are currently showing. */}
      {driver.lat && !isFollowing && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-48 right-4 z-30 flex size-12 items-center justify-center rounded-full bg-pasada-rust shadow-lg hover:shadow-xl transition-shadow"
        >
          <LocateFixed size={20} className="text-pasada-cream" />
        </button>
      )}

      {/* Demand legend — self-explanatory tier key, shown whenever any stop has waiting passengers */}
      {totalWaiting > 0 && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 rounded-full bg-white/90 shadow-md border border-pasada-border px-3 py-1.5">
          {DEMAND_TIERS.map((t) => (
            <span key={t.label} className="flex items-center gap-1 text-[9px] font-semibold text-pasada-dark whitespace-nowrap">
              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              {t.label}
            </span>
          ))}
        </div>
      )}

      {/* Status badge */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        {tripActive ? (
          <div className="flex items-center gap-1.5 rounded-full bg-white/90 shadow-lg border border-pasada-border px-4 py-1.5">
            <span className="size-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-pasada-dark uppercase tracking-wide">In Transit</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full bg-white/90 shadow-lg border border-pasada-border px-4 py-1.5">
            <span className="size-2 rounded-full bg-yellow-400" />
            <span className="text-xs font-bold text-pasada-dark uppercase tracking-wide">
              {driver.driver_name ?? "Driver"} · {driver.plate ?? "ABC 1234"}
            </span>
          </div>
        )}
      </div>

      {/* Bottom overlay */}
      <div
        className="absolute bottom-0 inset-x-0 z-10"
        style={{
          background: "linear-gradient(to top, rgba(237,242,244,1) 0%, rgba(237,242,244,0.97) 55%, rgba(237,242,244,0) 100%)",
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

        {/* Departure Confidence — only when idle */}
        {!tripActive && (scoreData || scoreLoading || scoreUnavailable) && (
          <div className="px-4 pb-2">
            <DepartureScore
              score={scoreData?.score ?? null}
              expectedPassengers={String(scoreData?.expected_passengers ?? "–")}
              travelTimeMin={scoreData?.travel_time_min ?? null}
              expectedRevenue={scoreData?.expected_revenue ?? null}
              recommendation={scoreData?.recommendation ?? null}
              loading={scoreLoading}
              unavailable={scoreUnavailable}
              onRefresh={onFetchScore}
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 px-4 pb-6">
          <button
            data-testid="update-occupancy-btn"
            onClick={onOpenModal}
            className="flex-1 rounded-xl border-2 border-pasada-border bg-white py-3.5 text-sm font-bold text-pasada-dark hover:bg-pasada-cream transition-colors"
          >
            Update Occupancy
          </button>
          {tripActive ? (
            <button
              data-testid="end-trip-btn"
              onClick={onEndTrip}
              className="flex-1 rounded-xl bg-red-600 py-3.5 text-sm font-bold text-white hover:bg-red-700 transition-colors"
            >
              End Trip
            </button>
          ) : (
            <button
              data-testid="start-trip-btn"
              onClick={onStartTrip}
              disabled={polyline.length < 2}
              className="flex-1 rounded-xl bg-pasada-rust py-3.5 text-sm font-bold text-white hover:bg-pasada-rust/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Trip
            </button>
          )}
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
