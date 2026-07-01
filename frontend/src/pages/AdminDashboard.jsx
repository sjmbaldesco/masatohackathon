import { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { GoogleMap, Marker, InfoWindow, PolylineF, CircleF } from "@react-google-maps/api";
import {
  LayoutDashboard, Activity, Truck, Users, Map as MapIcon,
  UserCheck, BarChart2, Settings, Bus, LogOut,
  TrendingUp, TrendingDown, Filter, Plus, X,
  ChevronRight, MapPin, Zap, AlertTriangle, Info,
  Star, Clock, Navigation, Download, MoreHorizontal, Menu,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useFirestore";
import { useIsMobile } from "../hooks/useIsMobile";
import { getAnalyticsInsights } from "../services/api";
import { DEFAULT_CENTER, MAPS_API_KEY, occupancyColor, GRAY_MAP_STYLE } from "../services/maps";
import KPICards from "../components/cooperative/KPICards";
import AIInsights from "../components/cooperative/AIInsights";

const NAV = [
  { id: "dashboard", label: "Dashboard",        icon: LayoutDashboard },
  { id: "live-ops",  label: "Live Operations",  icon: Activity        },
  { id: "fleet",     label: "Fleet Management", icon: Truck           },
  { id: "drivers",   label: "Drivers",          icon: Users           },
  { id: "routes",    label: "Routes",           icon: MapIcon         },
  { id: "demand",    label: "Passenger Demand", icon: UserCheck       },
  { id: "analytics", label: "Analytics",        icon: BarChart2       },
  { id: "settings",  label: "Settings",         icon: Settings        },
];

// Mobile gets a 4-item bottom bar (the tabs built "3 deep" + Dashboard) plus a
// "More" sheet for the stub sections, instead of the 8-item desktop sidebar.
const MOBILE_PRIMARY_IDS = ["dashboard", "live-ops", "demand", "analytics"];
const MOBILE_MORE_IDS    = ["fleet", "drivers", "routes", "settings"];

const MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  styles: GRAY_MAP_STYLE,
};

export default function AdminDashboard() {
  const { logout }           = useAuth();
  const [active, setActive]  = useState("dashboard");
  const [moreOpen, setMoreOpen] = useState(false);
  const isMobile = useIsMobile(1024);

  const { data: drivers    } = useCollection("drivers",    [["route",  "==", "R01"]]);
  const { data: passengers } = useCollection("passengers", [["route",  "==", "R01"], ["status", "==", "waiting"]]);
  const { data: stops      } = useCollection("stops");
  const { data: routes     } = useCollection("routes");

  const kpis = {
    totalWaiting:    passengers.length,
    activeDrivers:   drivers.filter((d) => d.status === "in_transit").length,
    avgOccupancyPct: drivers.length > 0
      ? Math.round(drivers.reduce((s, d) => s + (d.occupancy_pct ?? 0), 0) / drivers.length)
      : 0,
    totalDrivers: drivers.length,
  };

  const content = {
    dashboard: <DashboardPage kpis={kpis} drivers={drivers} passengers={passengers} />,
    "live-ops": <LiveOpsPage drivers={drivers} passengers={passengers} routes={routes} isActive={active === "live-ops"} />,
    fleet:      <FleetPage drivers={drivers} />,
    drivers:    <DriversPage drivers={drivers} />,
    routes:     <RoutesPage routes={routes} stops={stops} passengers={passengers} />,
    demand:     <DemandPage stops={stops} passengers={passengers} />,
    analytics:  <AnalyticsPage kpis={kpis} drivers={drivers} stops={stops} passengers={passengers} />,
    settings:   <SettingsPage />,
  };

  const activeNav = NAV.find((n) => n.id === active);

  // ── Dedicated mobile layout: top bar + bottom nav + "More" sheet ──────────
  // Branches in JS (not CSS) so only one shell is ever mounted — the desktop
  // sidebar/main and this tree both reference the same `content` elements,
  // and mounting both at once would spin up two live GoogleMap instances.
  if (isMobile) {
    const primaryItems = MOBILE_PRIMARY_IDS.map((id) => NAV.find((n) => n.id === id));
    const moreItems    = MOBILE_MORE_IDS.map((id) => NAV.find((n) => n.id === id));

    return (
      <div className="flex h-dvh flex-col bg-pasada-cream font-manrope overflow-hidden">
        {/* Top bar */}
        <header
          className="flex shrink-0 items-center justify-between border-b border-pasada-border bg-white px-4 py-3"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-pasada-rust/10">
              <Bus size={17} className="text-pasada-rust" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="font-garamond text-base font-bold text-pasada-dark leading-tight truncate">
                {activeNav?.label ?? "Pasada"}
              </p>
              <p className="text-[9px] font-semibold tracking-[0.1em] uppercase text-pasada-muted">
                Admin
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Switch role"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-pasada-muted hover:text-pasada-rust transition-colors"
          >
            <LogOut size={16} />
          </button>
        </header>

        {/* Content — all tabs stay mounted; inactive ones are hidden to keep GoogleMap alive */}
        <main className="relative flex-1 overflow-hidden">
          {Object.entries(content).map(([id, node]) => (
            <div
              key={id}
              className="absolute inset-0 overflow-y-auto"
              style={{ visibility: active === id ? "visible" : "hidden" }}
            >
              {node}
            </div>
          ))}
        </main>

        {/* Bottom nav */}
        <MobileBottomNav
          items={primaryItems}
          active={active}
          onChange={(id) => { setActive(id); setMoreOpen(false); }}
          moreActive={MOBILE_MORE_IDS.includes(active)}
          onMore={() => setMoreOpen(true)}
        />

        {moreOpen && (
          <MoreSheet
            items={moreItems}
            active={active}
            onSelect={(id) => { setActive(id); setMoreOpen(false); }}
            onClose={() => setMoreOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-pasada-cream font-manrope overflow-hidden">
      {/* Left sidebar */}
      <aside className="flex w-[210px] shrink-0 flex-col bg-white border-r border-pasada-border">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-pasada-border">
          <div className="flex size-9 items-center justify-center rounded-xl bg-pasada-rust/10">
            <Bus size={20} className="text-pasada-rust" strokeWidth={1.8} />
          </div>
          <div>
            <p className="font-garamond text-xl font-bold text-pasada-dark leading-tight">Pasada</p>
            <p className="text-[9px] font-semibold tracking-[0.15em] uppercase text-pasada-muted">
              Smart Jeepney Network
            </p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium mb-0.5 transition-colors
                  ${isActive
                    ? "bg-pasada-rust text-white"
                    : "text-pasada-warm hover:bg-pasada-cream"
                  }`}
              >
                <Icon size={17} strokeWidth={isActive ? 2.5 : 1.8} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="flex items-center gap-3 border-t border-pasada-border px-4 py-4">
          <div className="flex size-8 items-center justify-center rounded-full bg-pasada-rust text-xs font-black text-white shrink-0">
            J
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-pasada-dark truncate">Juan Dela Cruz</p>
            <p className="text-[11px] text-pasada-muted">System Administrator</p>
          </div>
          <button onClick={logout} title="Switch role" className="text-pasada-muted hover:text-pasada-rust transition-colors">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Main content — all tabs stay mounted; inactive ones are hidden to keep GoogleMap alive */}
      <main className="flex-1 overflow-hidden relative">
        {Object.entries(content).map(([id, node]) => (
          <div
            key={id}
            className="absolute inset-0 overflow-y-auto"
            style={{ visibility: active === id ? "visible" : "hidden" }}
          >
            {node}
          </div>
        ))}
      </main>
    </div>
  );
}

// ── Mobile Bottom Nav + "More" Sheet ────────────────────────────────────────────

function MobileBottomNav({ items, active, onChange, moreActive, onMore }) {
  return (
    <nav
      className="flex shrink-0 border-t border-pasada-border bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors
              ${isActive ? "text-pasada-rust" : "text-pasada-muted"}`}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className="tracking-wide">{label === "Live Operations" ? "Live Ops" : label === "Passenger Demand" ? "Demand" : label}</span>
          </button>
        );
      })}
      <button
        onClick={onMore}
        className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors
          ${moreActive ? "text-pasada-rust" : "text-pasada-muted"}`}
      >
        <MoreHorizontal size={20} strokeWidth={moreActive ? 2.5 : 1.8} />
        <span className="tracking-wide">More</span>
      </button>
    </nav>
  );
}

function MoreSheet({ items, active, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30" onClick={onClose}>
      <div
        className="w-full space-y-1 rounded-t-3xl bg-white p-4 shadow-2xl"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-pasada-border" />
        <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-widest text-pasada-muted">More</p>
        {items.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors
                ${isActive ? "bg-pasada-rust text-white" : "text-pasada-warm hover:bg-pasada-cream"}`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared Primitives ──────────────────────────────────────────────────────────

function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-6 pb-0 sm:flex-row sm:items-start sm:justify-between lg:px-8 lg:pt-8">
      <div>
        <h1 className="font-garamond text-2xl font-bold text-pasada-dark lg:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-pasada-muted max-w-xl">{subtitle}</p>}
      </div>
      {action && (
        <button className="flex items-center justify-center gap-2 rounded-xl bg-pasada-rust px-4 py-2.5 text-sm font-bold text-white hover:bg-pasada-rust/90 transition-colors shrink-0">
          {action}
        </button>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, trend, icon: Icon }) {
  return (
    <div className="rounded-2xl bg-white border border-pasada-border p-4 lg:p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-pasada-muted lg:text-xs">{label}</p>
          <p className="mt-1 text-2xl font-black text-pasada-dark lg:text-3xl">{value}</p>
          {sub && (
            <p className={`mt-1 text-xs font-medium flex items-center gap-1 ${trend === "up" ? "text-green-600" : trend === "down" ? "text-red-500" : "text-pasada-muted"}`}>
              {trend === "up" && <TrendingUp size={11} />}
              {trend === "down" && <TrendingDown size={11} />}
              {sub}
            </p>
          )}
        </div>
        {Icon && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-pasada-rust/10 lg:size-10">
            <Icon size={18} className="text-pasada-rust" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard Page ─────────────────────────────────────────────────────────────

function DashboardPage({ kpis, drivers, passengers }) {
  const recent = [
    { text: "Marcus Chen completed Route 14A", time: "2 min ago",   dot: "bg-green-500"   },
    { text: "High demand alert on R01",         time: "8 min ago",   dot: "bg-red-500"     },
    { text: "Sarah Jenkins is On Area",         time: "15 min ago",  dot: "bg-yellow-500"  },
    { text: "Dispatch interval updated for R01", time: "45 min ago", dot: "bg-blue-500"    },
  ];

  return (
    <div className="p-4 space-y-5 lg:p-8 lg:space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Real-time fleet and passenger overview."
      />

      <div className="grid grid-cols-2 gap-3 mt-4 lg:grid-cols-4 lg:gap-4 lg:mt-6">
        <KpiCard label="Waiting Passengers" value={kpis.totalWaiting}    icon={Users}    sub="+12% vs avg"   trend="up"   />
        <KpiCard label="Active Drivers"      value={kpis.activeDrivers}   icon={Bus}      sub="of total fleet"              />
        <KpiCard label="Avg Occupancy"       value={`${kpis.avgOccupancyPct}%`} icon={BarChart2} sub="fleet-wide"        />
        <KpiCard label="Total Drivers"       value={kpis.totalDrivers}    icon={UserCheck} sub="registered"               />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Recent activity */}
        <div className="rounded-2xl bg-white border border-pasada-border p-4 lg:p-5">
          <p className="text-sm font-bold text-pasada-dark mb-4">Recent Activity</p>
          <div className="space-y-3">
            {recent.map((r, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`mt-1 size-2 shrink-0 rounded-full ${r.dot}`} />
                <div>
                  <p className="text-sm text-pasada-dark">{r.text}</p>
                  <p className="text-xs text-pasada-muted">{r.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top drivers */}
        <div className="rounded-2xl bg-white border border-pasada-border p-4 lg:p-5">
          <p className="text-sm font-bold text-pasada-dark mb-4">Top Drivers Today</p>
          <div className="space-y-3">
            {[
              { name: "Marcus Chen",    trips: 12, rating: 4.8 },
              { name: "Sarah Jenkins",  trips: 9,  rating: 4.9 },
              { name: "David Alaba",    trips: 7,  rating: 4.5 },
            ].map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-pasada-rust/10 text-xs font-bold text-pasada-rust">
                    {d.name[0]}
                  </div>
                  <p className="text-sm font-semibold text-pasada-dark">{d.name}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-pasada-muted">
                  <span>{d.trips} trips</span>
                  <span className="flex items-center gap-0.5 text-pasada-rust font-semibold">
                    <Star size={10} fill="currentColor" />
                    {d.rating}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Live Operations Page ───────────────────────────────────────────────────────

function LiveOpsPage({ drivers, passengers, routes = [], isActive }) {
  const [selectedDriver, setSelectedDriver] = useState(null);
  const mapRef = useRef(null);
  const isMobile = useIsMobile(1024);

  // Trigger a resize when the tab becomes visible so the map fills its container
  useEffect(() => {
    if (isActive && mapRef.current && window.google?.maps) {
      window.google.maps.event.trigger(mapRef.current, "resize");
    }
  }, [isActive]);

  const activeDrivers = useMemo(() => drivers.filter((d) => d.lat && d.lng), [drivers]);
  const waitingPassengers = useMemo(
    () => passengers.filter((p) => typeof p.lat === "number" && typeof p.lng === "number"),
    [passengers]
  );

  const routePolyline = useMemo(() => {
    const rd = routes.find((r) => r.route_id === "R01");
    return (rd?.polyline ?? []).map((p) =>
      Array.isArray(p) ? { lat: p[0], lng: p[1] } : { lat: p.lat, lng: p.lng }
    );
  }, [routes]);

  const jeepIcon = (color) => MAPS_API_KEY ? {
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#fff",
    strokeWeight: 2,
    scale: 1.4,
    anchor: { x: 12, y: 22 },
  } : undefined;

  // Aggregate passengers by approximate position (≈11m grid) for density coloring
  const demandSpots = useMemo(() => {
    const map = new Map();
    for (const p of waitingPassengers) {
      const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
      if (!map.has(key)) map.set(key, { lat: p.lat, lng: p.lng, count: 0 });
      map.get(key).count++;
    }
    return [...map.values()];
  }, [waitingPassengers]);

  function demandColor(cnt) {
    if (cnt <= 2) return "#2563EB";
    if (cnt <= 4) return "#0D9488";
    if (cnt <= 7) return "#F97316";
    return "#D90429";
  }

  return (
    <div className="p-4 space-y-4 lg:p-8">
      <PageHeader
        title="Live Operations"
        subtitle="Real-time fleet map with route overlay, vehicle tracking, and passenger demand."
      />

      <div
        className="grid grid-cols-1 gap-4 mt-4 lg:grid-cols-3 lg:mt-6"
        style={{ height: isMobile ? "auto" : "calc(100vh - 220px)" }}
      >
        {/* Map */}
        <div
          className="rounded-2xl overflow-hidden border border-pasada-border lg:col-span-2"
          style={{ height: isMobile ? "45vh" : "100%" }}
        >
          {MAPS_API_KEY ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={DEFAULT_CENTER}
              zoom={12}
              options={MAP_OPTIONS}
              onLoad={(map) => { mapRef.current = map; }}
            >
              {/* Route polyline */}
              {routePolyline.length > 1 && (
                <PolylineF
                  key={routePolyline.length}
                  path={routePolyline}
                  options={{ strokeColor: "#EF233C", strokeWeight: 4, strokeOpacity: 0.65 }}
                />
              )}

              {/* Density heatmap — two concentric circles, cool-to-hot by passenger count */}
              {demandSpots.flatMap((s) => {
                const color = demandColor(s.count);
                return [
                  <CircleF key={`${s.lat},${s.lng}-o`} center={{ lat: s.lat, lng: s.lng }}
                    radius={100 + s.count * 20}
                    options={{ strokeWeight: 0, fillColor: color, fillOpacity: 0.11 }} />,
                  <CircleF key={`${s.lat},${s.lng}-i`} center={{ lat: s.lat, lng: s.lng }}
                    radius={45 + s.count * 8}
                    options={{ strokeWeight: 0, fillColor: color, fillOpacity: 0.30 }} />,
                ];
              })}

              {/* Driver/jeep markers — colored by occupancy */}
              {activeDrivers.map((d) => {
                const color = occupancyColor(d.occupancy_pct ?? 0);
                return (
                  <Marker
                    key={d.uid}
                    position={{ lat: d.lat, lng: d.lng }}
                    icon={jeepIcon(color)}
                    onClick={() => setSelectedDriver(d)}
                  />
                );
              })}

              {selectedDriver && (
                <InfoWindow
                  position={{ lat: selectedDriver.lat, lng: selectedDriver.lng }}
                  onCloseClick={() => setSelectedDriver(null)}
                >
                  <div className="font-manrope p-1 min-w-[130px]">
                    <p className="font-bold text-pasada-dark text-sm">{selectedDriver.plate ?? "—"}</p>
                    <p className="text-xs text-pasada-muted">{selectedDriver.driver_name ?? "Driver"}</p>
                    <p className="text-xs text-pasada-warm mt-1">
                      {selectedDriver.occupancy_pct ?? 0}% full · {selectedDriver.current_stop ?? "—"}
                    </p>
                    <p className="text-xs text-pasada-muted">{selectedDriver.speed_kmh ?? 0} km/h</p>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <div className="w-full h-full bg-pasada-cream flex items-center justify-center">
              <p className="text-pasada-warm text-sm">Add VITE_GOOGLE_MAPS_API_KEY to show map</p>
            </div>
          )}
        </div>

        {/* Side list */}
        <div className={`flex flex-col gap-3 ${isMobile ? "" : "overflow-y-auto"}`}>
          {/* Legend */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-pasada-muted">
              Active Units ({activeDrivers.length})
            </p>
            <div className="flex items-center gap-2 text-[10px] text-pasada-muted">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-green-500" />Low</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-yellow-500" />Mid</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-500" />High</span>
            </div>
          </div>

          {/* Waiting passengers summary */}
          {waitingPassengers.length > 0 && (
            <div className="rounded-xl bg-pasada-rust/5 border border-pasada-rust/20 px-3 py-2 flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-pasada-rust shrink-0" />
              <span className="text-xs text-pasada-rust font-semibold">
                {waitingPassengers.length} passenger{waitingPassengers.length !== 1 ? "s" : ""} waiting — heatmap shown
              </span>
            </div>
          )}

          {activeDrivers.length === 0 ? (
            <div className="rounded-2xl bg-white border border-pasada-border p-6 text-center">
              <p className="text-sm text-pasada-muted">No active drivers. Run seed_demo.py to populate.</p>
            </div>
          ) : (
            activeDrivers.map((d) => {
              const pct   = d.occupancy_pct ?? 0;
              const color = occupancyColor(pct);
              return (
                <button
                  key={d.uid}
                  onClick={() => setSelectedDriver(d)}
                  className="rounded-xl bg-white border border-pasada-border p-3 text-left hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-bold text-pasada-dark">{d.plate ?? "—"}</p>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: color + "22", color }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <p className="text-xs text-pasada-muted">{d.driver_name ?? "Driver"}</p>
                  <p className="text-xs text-pasada-muted mt-0.5">{d.current_stop ?? "—"} · {d.speed_kmh ?? 0} km/h</p>
                  <div className="mt-1.5 h-1 rounded-full bg-pasada-cream">
                    <div
                      className="h-1 rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Fleet Management Page ──────────────────────────────────────────────────────

const FLEET = [
  { id: "F-01", model: "Volvo 9900",       plate: "AAC 123", route: "R01 Lumban",         status: "Active",   occ: 78, maint: "Jan 2025" },
  { id: "F-09", model: "Ford Transit",     plate: "DRV 022", route: "R03C University Loop", status: "Active", occ: 62, maint: "Feb 2025" },
  { id: "F-18", model: "Mercedes Sprinter",plate: "DRV 910", route: "R07 Airport Shuttle", status: "On Area", occ: 45, maint: "Mar 2025" },
  { id: "F-42", model: "Isuzu Crosswind",  plate: "DRV 553", route: "—",                  status: "Off Duty", occ: 0,  maint: "Apr 2025" },
];

const FLEET_STATUS_STYLE = {
  Active:    "bg-green-50 text-green-700",
  "On Area": "bg-yellow-50 text-yellow-700",
  "Off Duty":"bg-gray-100 text-gray-500",
};

function FleetPage({ drivers }) {
  const isMobile = useIsMobile(1024);

  return (
    <div className="p-4 space-y-5 lg:p-8 lg:space-y-6">
      <PageHeader
        title="Fleet Management"
        subtitle="Overview of all registered vehicles and their operational status."
        action={<><Plus size={16} />Add Vehicle</>}
      />

      {isMobile ? (
        <div className="space-y-3">
          {FLEET.map((v) => {
            const occColor = occupancyColor(v.occ);
            return (
              <div key={v.id} className="rounded-2xl bg-white border border-pasada-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-bold text-pasada-rust">{v.id}</p>
                    <p className="font-semibold text-pasada-dark truncate">{v.model}</p>
                    <p className="text-xs text-pasada-muted">{v.plate}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${FLEET_STATUS_STYLE[v.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {v.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-pasada-warm">{v.route}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-pasada-cream">
                    <div className="h-1.5 rounded-full" style={{ width: `${v.occ}%`, backgroundColor: occColor }} />
                  </div>
                  <span className="text-xs font-semibold shrink-0" style={{ color: occColor }}>{v.occ}%</span>
                </div>
                <p className="mt-2 text-[11px] text-pasada-muted">Next maintenance: {v.maint}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-white border border-pasada-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pasada-border bg-pasada-cream/50">
                {["Vehicle ID", "Model & Plate", "Route", "Status", "Occupancy", "Next Maintenance"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-pasada-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-pasada-border">
              {FLEET.map((v) => {
                const occColor = occupancyColor(v.occ);
                return (
                  <tr key={v.id} className="hover:bg-pasada-cream/30 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs font-bold text-pasada-rust">{v.id}</td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-pasada-dark">{v.model}</p>
                      <p className="text-xs text-pasada-muted">{v.plate}</p>
                    </td>
                    <td className="px-5 py-4 text-pasada-warm">{v.route}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${FLEET_STATUS_STYLE[v.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-pasada-cream">
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${v.occ}%`, backgroundColor: occColor }}
                          />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: occColor }}>{v.occ}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-pasada-muted text-xs">{v.maint}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Drivers Page ───────────────────────────────────────────────────────────────

const DRIVERS_SEED = [
  { name: "Marcus Chen",  id: "DRV-8492", status: "Active",   route: "Route 14A - Downtown Express",  vehicle: "Volvo 9900 (Fleet #42)",       rating: 4.8, trips: 12 },
  { name: "Sarah Jenkins",id: "DRV-9104", status: "On Area",  route: "Route 7 - Airport Shuttle",     vehicle: "Mercedes Sprinter (Fleet #18)", rating: 4.9, trips: 9  },
  { name: "David Alaba",  id: "DRV-1022", status: "Active",   route: "Route 3C - University Loop",    vehicle: "Ford Transit (Fleet #09)",      rating: 4.5, trips: 7  },
  { name: "Elena Winters", id: "DRV-5531", status: "Off Duty", route: "—",                            vehicle: "Unassigned",                    rating: 4.7, trips: 0  },
];

const DRIVER_STATUS_STYLE = {
  Active:    "bg-green-50 text-green-700 border-green-200",
  "On Area": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Off Duty":"bg-gray-100 text-gray-500 border-gray-200",
};

function DriversPage({ drivers }) {
  const isMobile = useIsMobile(1024);
  const [selected, setSelected] = useState(DRIVERS_SEED[0]);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  return (
    <div className="p-4 space-y-5 lg:p-8 lg:space-y-6">
      <PageHeader
        title="Driver Roster"
        subtitle="Manage and monitor active fleet personnel across all active routes."
        action={<><Plus size={16} />Add Driver</>}
      />

      {isMobile ? (
        <div className="space-y-3">
          {DRIVERS_SEED.map((d) => (
            <button
              key={d.id}
              onClick={() => { setSelected(d); setMobileDetailOpen(true); }}
              className="w-full rounded-2xl bg-white border border-pasada-border p-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pasada-rust/10 text-sm font-bold text-pasada-rust">
                  {d.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-pasada-dark truncate">{d.name}</p>
                  <p className="text-xs text-pasada-muted">{d.vehicle}</p>
                </div>
                <ChevronRight size={16} className="text-pasada-muted shrink-0" />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${DRIVER_STATUS_STYLE[d.status] ?? ""}`}>
                  {d.status}
                </span>
                <span className="flex items-center gap-1 text-xs">
                  <Star size={11} className="text-pasada-rust" fill="currentColor" />
                  <span className="font-bold text-pasada-dark">{d.rating}</span>
                  <span className="text-pasada-muted">/5</span>
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 flex gap-6" style={{ minHeight: "calc(100vh - 220px)" }}>
          {/* Table */}
          <div className="flex-1 rounded-2xl bg-white border border-pasada-border overflow-hidden self-start">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pasada-border bg-pasada-cream/50">
                  {["Driver", "ID / Status", "Vehicle & Route", "Performance"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-pasada-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-pasada-border">
                {DRIVERS_SEED.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelected(d)}
                    className={`cursor-pointer transition-colors hover:bg-pasada-cream/30 ${selected?.id === d.id ? "bg-pasada-rust/5" : ""}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-pasada-rust/10 text-sm font-bold text-pasada-rust">
                          {d.name[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-pasada-dark">{d.name}</p>
                          <p className="text-xs text-pasada-muted">Joined 2022</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-mono text-xs text-pasada-rust font-bold">{d.id}</p>
                      <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${DRIVER_STATUS_STYLE[d.status] ?? ""}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-pasada-dark text-xs">{d.vehicle}</p>
                      <p className="text-xs text-pasada-muted mt-0.5">{d.route}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Star size={12} className="text-pasada-rust" fill="currentColor" />
                        <span className="text-sm font-bold text-pasada-dark">{d.rating}</span>
                        <span className="text-xs text-pasada-muted">/5</span>
                      </div>
                      <div className="mt-1 h-1 w-20 rounded-full bg-pasada-cream">
                        <div
                          className="h-1 rounded-full bg-pasada-rust"
                          style={{ width: `${(d.rating / 5) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-[280px] shrink-0 rounded-2xl bg-white border border-pasada-border p-5 space-y-4 self-start">
              <DriverDetailContent selected={selected} />
            </div>
          )}
        </div>
      )}

      {/* Mobile detail sheet */}
      {isMobile && mobileDetailOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30" onClick={() => setMobileDetailOpen(false)}>
          <div
            className="w-full max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white p-5 space-y-4 shadow-2xl"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto -mt-1 mb-1 h-1 w-10 rounded-full bg-pasada-border" />
            <DriverDetailContent selected={selected} />
          </div>
        </div>
      )}
    </div>
  );
}

function DriverDetailContent({ selected }) {
  return (
    <>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-pasada-rust/10 text-xl font-black text-pasada-rust">
            {selected.name[0]}
          </div>
          <div>
            <p className="font-bold text-pasada-dark">{selected.name}</p>
            <p className="text-xs font-mono text-pasada-muted">ID: {selected.id}</p>
            <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${DRIVER_STATUS_STYLE[selected.status] ?? ""}`}>
              {selected.status}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Attendance",    value: "98%",  sub: "+2% this month" },
          { label: "Trips Today",   value: selected.trips, sub: "Avg 14 per shift" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl bg-pasada-cream p-3">
            <p className="text-xs text-pasada-muted">{label}</p>
            <p className="text-xl font-black text-pasada-dark">{value}</p>
            <p className="text-[10px] text-green-600 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-pasada-muted mb-2">
          Safety Score
        </p>
        <div className="flex items-center justify-between mb-1">
          <div className="flex-1 h-2 rounded-full bg-pasada-cream mr-3">
            <div className="h-2 rounded-full bg-pasada-rust w-[92%]" />
          </div>
          <span className="text-sm font-black text-pasada-rust">A+</span>
        </div>
        <p className="text-xs text-pasada-muted">0 incidents in 6 months</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-pasada-muted mb-2">
          Current Assignment
        </p>
        <div className="rounded-xl bg-pasada-cream p-3">
          <p className="text-sm font-bold text-pasada-dark">{selected.route}</p>
          <p className="text-xs text-pasada-muted mt-0.5">{selected.vehicle}</p>
          <div className="flex justify-between text-[10px] text-pasada-muted mt-2">
            <span>Started: 06:00 AM</span>
            <span>Ends: 14:00 PM</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="flex-1 rounded-xl border border-pasada-border bg-white py-2.5 text-xs font-bold text-pasada-warm hover:bg-pasada-cream transition-colors">
          Message
        </button>
        <button className="flex-1 rounded-xl bg-pasada-rust py-2.5 text-xs font-bold text-white hover:bg-pasada-rust/90 transition-colors">
          Assign
        </button>
      </div>
    </>
  );
}

// ── Routes Page ────────────────────────────────────────────────────────────────

const ROUTES_DATA = [
  {
    id: "R01", from: "Lumban", to: "Santa Cruz", demand: "HIGH DEMAND",
    demandColor: "bg-red-100 text-red-700", icon: TrendingUp, iconColor: "text-red-500",
    active: 12, eta: 8, waiting: 246, congestion: "Heavy", utilization: 92,
  },
  {
    id: "R02", from: "Santa Cruz", to: "Pagsanjan", demand: "MODERATE",
    demandColor: "bg-yellow-100 text-yellow-700", icon: Navigation, iconColor: "text-yellow-500",
    active: 8, eta: 12, waiting: 136, congestion: "Normal", utilization: 68,
  },
  {
    id: "R03", from: "Pagsanjan", to: "Lumban", demand: "LOW DEMAND",
    demandColor: "bg-green-100 text-green-700", icon: TrendingDown, iconColor: "text-green-500",
    active: 4, eta: 15, waiting: 28, congestion: "Smooth", utilization: 34,
  },
];

function RoutesPage({ routes, stops, passengers }) {
  const systemAlerts = [
    {
      type: "warning", icon: AlertTriangle,
      title: "Traffic Congestion Detected",
      body: "National Highway approach to Santa Cruz junction experiencing heavy buildup. ETA impacted by +5 mins.",
      time: "15 MINS AGO",
    },
    {
      type: "info", icon: Info,
      title: "Dispatch Interval Updated",
      body: "System auto-adjusted Lumban → Santa Cruz dispatch interval to 8 mins due to demand spike.",
      time: "45 MINS AGO",
    },
  ];

  return (
    <div className="p-4 space-y-5 lg:p-8 lg:space-y-6">
      <PageHeader
        title="Route Management"
        subtitle="Monitor active routes, optimize dispatch intervals based on real-time passenger demand, and resolve congestion issues."
        action={<><Plus size={16} />Add New Route</>}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:mt-6 lg:grid-cols-3 lg:gap-6">
        {/* Route cards */}
        <div className="space-y-4 lg:col-span-2">
          {ROUTES_DATA.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.id} className={`rounded-2xl bg-white border-l-4 border border-pasada-border p-4 lg:p-5 ${r.demand === "HIGH DEMAND" ? "border-l-red-400" : r.demand === "MODERATE" ? "border-l-yellow-400" : "border-l-green-400"}`}>
                <div className="flex items-start justify-between mb-4 gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl bg-pasada-cream`}>
                      <Icon size={18} className={r.iconColor} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-pasada-dark">{r.from} → {r.to}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.demandColor}`}>
                          {r.demand}
                        </span>
                      </div>
                      <p className="text-xs text-pasada-muted mt-0.5">{r.active} Active Jeepneys</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black text-pasada-dark">{r.eta}</p>
                    <p className="text-[10px] text-pasada-muted">AVG ETA</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4 lg:gap-3">
                  {[
                    { label: "Waiting Passengers", value: r.waiting, sub: "+18% vs avg" },
                    { label: "Route Congestion",   value: r.congestion },
                    { label: "Fleet Utilization",  value: `${r.utilization}%` },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="rounded-xl bg-pasada-cream p-3">
                      <p className="text-[10px] text-pasada-muted uppercase tracking-wide">{label}</p>
                      <p className="text-lg font-black text-pasada-dark mt-0.5">{value}</p>
                      {sub && <p className="text-[10px] text-pasada-muted mt-0.5">{sub}</p>}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button className="text-sm font-semibold text-pasada-rust hover:underline">
                    View Route Details →
                  </button>
                  <button className="flex items-center gap-1.5 rounded-xl border border-pasada-border px-3 py-2 text-xs font-bold text-pasada-warm hover:bg-pasada-cream transition-colors">
                    <Filter size={12} />
                    Optimize Dispatch
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Mini map */}
          <div className="rounded-2xl overflow-hidden border border-pasada-border" style={{ height: 200 }}>
            {MAPS_API_KEY ? (
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={DEFAULT_CENTER}
                zoom={11}
                options={{ ...MAP_OPTIONS, disableDefaultUI: true }}
              />
            ) : (
              <div className="w-full h-full bg-pasada-cream flex items-center justify-center">
                <p className="text-pasada-muted text-xs">Live Traffic Overview</p>
              </div>
            )}
          </div>

          {/* System alerts */}
          <div className="rounded-2xl bg-white border border-pasada-border p-4">
            <p className="text-sm font-bold text-pasada-dark mb-3">System Alerts</p>
            <div className="space-y-3">
              {systemAlerts.map((a, i) => {
                const Icon = a.icon;
                return (
                  <div key={i} className="flex gap-2.5">
                    <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${a.type === "warning" ? "bg-orange-100" : "bg-blue-50"}`}>
                      <Icon size={13} className={a.type === "warning" ? "text-orange-600" : "text-blue-600"} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-pasada-dark">{a.title}</p>
                      <p className="text-xs text-pasada-muted mt-0.5 leading-relaxed">{a.body}</p>
                      <p className="text-[10px] text-pasada-muted/60 mt-1">{a.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Passenger Demand Page ──────────────────────────────────────────────────────

function DemandPage({ stops, passengers }) {
  const isMobile = useIsMobile(1024);
  const totalWaiting = passengers.length;

  const stopDemand = stops.map((s) => ({
    name: s.name ?? s.stop ?? s.id,
    count: s.count ?? passengers.filter((p) => p.stop === (s.name ?? s.stop)).length,
    lat: s.lat,
    lng: s.lng,
  }));
  const maxCount = Math.max(...stopDemand.map((x) => x.count), 1);

  return (
    <div className="p-4 space-y-5 lg:p-8 lg:space-y-6">
      <PageHeader
        title="Passenger Demand"
        subtitle="Live waiting passenger counts aggregated by stop and route."
      />

      <div className="grid grid-cols-2 gap-3 mt-4 lg:mt-6 lg:grid-cols-4 lg:gap-4">
        <KpiCard label="Total Waiting"  value={totalWaiting}                  icon={Users}    />
        <KpiCard label="Hottest Stop"   value={stopDemand.sort((a,b)=>b.count-a.count)[0]?.name ?? "—"} icon={MapPin} />
        <KpiCard label="Routes Active"  value="3"                              icon={Navigation} />
        <KpiCard label="Avg Wait Time"  value="6 min"                          icon={Clock}    />
      </div>

      {stopDemand.length === 0 ? (
        <div className="rounded-2xl bg-white border border-pasada-border p-8 text-center text-pasada-muted">
          No stop data. Run the seed script to populate.
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {stopDemand.map((s, i) => {
            const pct = Math.round((s.count / maxCount) * 100);
            const color = pct > 70 ? "#D90429" : pct > 40 ? "#EF233C" : "#388E3C";
            return (
              <div key={i} className="rounded-2xl bg-white border border-pasada-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin size={14} className="text-pasada-rust shrink-0" />
                    <span className="font-semibold text-pasada-dark truncate">{s.name}</span>
                  </div>
                  <span className="text-lg font-black text-pasada-dark shrink-0">{s.count}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-pasada-cream">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-pasada-muted">
                  <span>Route R01</span>
                  <span>Updated just now</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-pasada-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pasada-border bg-pasada-cream/50">
                {["Stop", "Route", "Waiting", "Demand Bar", "Last Updated"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-pasada-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-pasada-border">
              {stopDemand.map((s, i) => {
                const pct = Math.round((s.count / maxCount) * 100);
                const color = pct > 70 ? "#D90429" : pct > 40 ? "#EF233C" : "#388E3C";
                return (
                  <tr key={i} className="hover:bg-pasada-cream/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-pasada-rust" />
                        <span className="font-semibold text-pasada-dark">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-pasada-muted">R01</td>
                    <td className="px-5 py-4">
                      <span className="text-lg font-black text-pasada-dark">{s.count}</span>
                    </td>
                    <td className="px-5 py-4 w-48">
                      <div className="h-2 rounded-full bg-pasada-cream">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-pasada-muted">Just now</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Analytics Page ─────────────────────────────────────────────────────────────

function AnalyticsPage({ kpis, drivers, stops = [], passengers = [] }) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
      const wb = XLSX.utils.book_new();

      // ─ Summary sheet ─
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["Pasada Fleet Report", "", now],
        [],
        ["Metric", "Value"],
        ["Total Active Drivers", kpis.activeDrivers],
        ["Waiting Passengers",   kpis.totalWaiting],
        ["Avg Occupancy %",      kpis.avgOccupancyPct],
        ["Total Drivers",        kpis.totalDrivers],
      ]), "Summary");

      // ─ Drivers sheet ─
      const driverRows = [
        ["UID", "Plate", "Driver Name", "Status", "Occupancy %", "Speed km/h", "Current Stop"],
        ...drivers.map((d) => [
          d.uid ?? d.id, d.plate ?? "—", d.driver_name ?? "Driver",
          d.status ?? "—", d.occupancy_pct ?? 0, d.speed_kmh ?? 0, d.current_stop ?? "—",
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(driverRows), "Drivers");

      // ─ Demand sheet ─
      const stopDemand = stops.map((s) => ({
        name: s.name ?? s.stop ?? s.id,
        count: s.count ?? passengers.filter((p) => p.stop === (s.name ?? s.stop)).length,
      }));
      const demandRows = [
        ["Stop", "Waiting Passengers"],
        ...stopDemand.map((s) => [s.name, s.count]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(demandRows), "Demand");

      // ─ AI Insights sheet (soft-fail) ─
      let insights = [
        `Route R01: ${kpis.activeDrivers} driver(s), ${kpis.totalWaiting} waiting.`,
        `Avg occupancy ${kpis.avgOccupancyPct}% — ${kpis.avgOccupancyPct > 70 ? "above" : "below"} optimal.`,
        "Review dispatch intervals against live demand data.",
      ];
      try {
        const res = await getAnalyticsInsights({
          active_drivers: kpis.activeDrivers,
          total_waiting:  kpis.totalWaiting,
          avg_occupancy_pct: kpis.avgOccupancyPct,
          route: "R01",
        });
        if (res.data?.insights?.length) insights = res.data.insights;
      } catch (_) { /* backend unavailable — use fallback */ }

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["AI Insights", now],
        [],
        ...insights.map((text, i) => [`${i + 1}.`, text]),
      ]), "AI Insights");

      XLSX.writeFile(wb, `pasada-report-${Date.now()}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-4 space-y-5 lg:p-8 lg:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-garamond text-2xl font-bold text-pasada-dark lg:text-4xl">Analytics</h1>
          <p className="mt-1 text-sm text-pasada-muted max-w-xl">
            Fleet performance metrics, revenue trends, and AI-powered insights.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center justify-center gap-2 rounded-xl bg-pasada-dark px-4 py-2.5 text-sm font-bold text-white hover:bg-pasada-dark/90 transition-colors disabled:opacity-60 shrink-0"
        >
          <Download size={16} />
          {exporting ? "Exporting…" : "Export to Excel"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2 lg:grid-cols-4 lg:gap-4">
        <KpiCard label="Weekly Revenue"   value="₱24,840"  sub="+8% vs last week"  trend="up"   icon={TrendingUp}  />
        <KpiCard label="Total Trips"       value="247"      sub="+15 vs last week"  trend="up"   icon={Navigation}  />
        <KpiCard label="Avg Occupancy"     value={`${kpis.avgOccupancyPct}%`}       sub="fleet average"         icon={Users}       />
        <KpiCard label="Driver Rating"     value="4.7 ★"   sub="avg across fleet"               icon={Star}        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <KPICards kpis={kpis} />
        <AIInsights />
      </div>
    </div>
  );
}

// ── Settings Page ──────────────────────────────────────────────────────────────

function SettingsPage() {
  return (
    <div className="p-4 space-y-5 lg:p-8 lg:space-y-6">
      <PageHeader title="Settings" subtitle="System configuration and preferences." />

      <div className="mt-4 max-w-lg space-y-3 lg:mt-6 lg:space-y-4">
        {[
          { label: "Dispatch Algorithm",   value: "AI-Optimized (v2)"     },
          { label: "Demand Update Interval", value: "30 seconds"           },
          { label: "Map Provider",         value: "Google Maps Platform"  },
          { label: "Notification Channel", value: "Firebase Cloud Messaging" },
          { label: "Route Count",          value: "3 active routes"       },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-2xl bg-white border border-pasada-border px-4 py-3.5 lg:px-5 lg:py-4">
            <div className="min-w-0">
              <p className="font-semibold text-pasada-dark">{label}</p>
              <p className="text-xs text-pasada-muted mt-0.5">{value}</p>
            </div>
            <button className="shrink-0 text-xs font-bold text-pasada-rust hover:underline">Edit</button>
          </div>
        ))}
      </div>
    </div>
  );
}
