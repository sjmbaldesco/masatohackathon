import { useState } from "react";
import { GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import {
  LayoutDashboard, Activity, Truck, Users, Map,
  UserCheck, BarChart2, Settings, Bus, LogOut,
  TrendingUp, TrendingDown, Filter, Plus, X,
  ChevronRight, MapPin, Zap, AlertTriangle, Info,
  Star, Clock, Navigation,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useFirestore";
import { DEFAULT_CENTER, MAPS_API_KEY, occupancyColor } from "../services/maps";
import KPICards from "../components/cooperative/KPICards";
import AIInsights from "../components/cooperative/AIInsights";

const NAV = [
  { id: "dashboard", label: "Dashboard",        icon: LayoutDashboard },
  { id: "live-ops",  label: "Live Operations",  icon: Activity        },
  { id: "fleet",     label: "Fleet Management", icon: Truck           },
  { id: "drivers",   label: "Drivers",          icon: Users           },
  { id: "routes",    label: "Routes",           icon: Map             },
  { id: "demand",    label: "Passenger Demand", icon: UserCheck       },
  { id: "analytics", label: "Analytics",        icon: BarChart2       },
  { id: "settings",  label: "Settings",         icon: Settings        },
];

const MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  styles: [
    { elementType: "geometry",           stylers: [{ color: "#f0e8da" }] },
    { elementType: "labels.text.fill",   stylers: [{ color: "#7a5c42" }] },
    { featureType: "road", elementType: "geometry",  stylers: [{ color: "#ffffff" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#bdd5e0" }] },
    { featureType: "poi",     stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
  ],
};

export default function AdminDashboard() {
  const { logout }           = useAuth();
  const [active, setActive]  = useState("dashboard");

  const { data: drivers    } = useCollection("drivers");
  const { data: passengers } = useCollection("passengers", [["status", "==", "waiting"]]);
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
    "live-ops": <LiveOpsPage drivers={drivers} passengers={passengers} />,
    fleet:      <FleetPage drivers={drivers} />,
    drivers:    <DriversPage drivers={drivers} />,
    routes:     <RoutesPage routes={routes} stops={stops} passengers={passengers} />,
    demand:     <DemandPage stops={stops} passengers={passengers} />,
    analytics:  <AnalyticsPage kpis={kpis} drivers={drivers} />,
    settings:   <SettingsPage />,
  };

  const activeNav = NAV.find((n) => n.id === active);

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
              Transport Ops
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

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {content[active]}
      </main>
    </div>
  );
}

// ── Shared Primitives ──────────────────────────────────────────────────────────

function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between px-8 pt-8 pb-0">
      <div>
        <h1 className="font-garamond text-4xl font-bold text-pasada-dark">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-pasada-muted max-w-xl">{subtitle}</p>}
      </div>
      {action && (
        <button className="flex items-center gap-2 rounded-xl bg-pasada-rust px-4 py-2.5 text-sm font-bold text-white hover:bg-pasada-rust/90 transition-colors shrink-0">
          {action}
        </button>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, trend, icon: Icon }) {
  return (
    <div className="rounded-2xl bg-white border border-pasada-border p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-pasada-muted">{label}</p>
          <p className="mt-1 text-3xl font-black text-pasada-dark">{value}</p>
          {sub && (
            <p className={`mt-1 text-xs font-medium flex items-center gap-1 ${trend === "up" ? "text-green-600" : trend === "down" ? "text-red-500" : "text-pasada-muted"}`}>
              {trend === "up" && <TrendingUp size={11} />}
              {trend === "down" && <TrendingDown size={11} />}
              {sub}
            </p>
          )}
        </div>
        {Icon && (
          <div className="flex size-10 items-center justify-center rounded-xl bg-pasada-rust/10">
            <Icon size={20} className="text-pasada-rust" />
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
    <div className="p-8 space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Real-time fleet and passenger overview."
      />

      <div className="grid grid-cols-4 gap-4 mt-6">
        <KpiCard label="Waiting Passengers" value={kpis.totalWaiting}    icon={Users}    sub="+12% vs avg"   trend="up"   />
        <KpiCard label="Active Drivers"      value={kpis.activeDrivers}   icon={Bus}      sub="of total fleet"              />
        <KpiCard label="Avg Occupancy"       value={`${kpis.avgOccupancyPct}%`} icon={BarChart2} sub="fleet-wide"        />
        <KpiCard label="Total Drivers"       value={kpis.totalDrivers}    icon={UserCheck} sub="registered"               />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent activity */}
        <div className="rounded-2xl bg-white border border-pasada-border p-5">
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
        <div className="rounded-2xl bg-white border border-pasada-border p-5">
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

function LiveOpsPage({ drivers, passengers }) {
  const [selectedDriver, setSelectedDriver] = useState(null);

  const mapCenter = DEFAULT_CENTER;
  const activeDrivers = drivers.filter((d) => d.lat && d.lng);

  return (
    <div className="p-8 space-y-4">
      <PageHeader
        title="Live Operations"
        subtitle="Real-time fleet map with vehicle tracking and demand heatmap."
      />

      <div className="grid grid-cols-3 gap-4 mt-6" style={{ height: "calc(100vh - 220px)" }}>
        {/* Map */}
        <div className="col-span-2 rounded-2xl overflow-hidden border border-pasada-border">
          {MAPS_API_KEY ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={mapCenter}
              zoom={13}
              options={MAP_OPTIONS}
            >
              {activeDrivers.map((d) => {
                const pct  = d.occupancy_pct ?? 0;
                const color = occupancyColor(pct);
                return (
                  <Marker
                    key={d.uid}
                    position={{ lat: d.lat, lng: d.lng }}
                    icon={MAPS_API_KEY ? {
                      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
                      fillColor: color,
                      fillOpacity: 1,
                      strokeColor: "#fff",
                      strokeWeight: 2,
                      scale: 1.4,
                      anchor: { x: 12, y: 22 },
                    } : undefined}
                    onClick={() => setSelectedDriver(d)}
                  />
                );
              })}
              {selectedDriver && (
                <InfoWindow
                  position={{ lat: selectedDriver.lat, lng: selectedDriver.lng }}
                  onCloseClick={() => setSelectedDriver(null)}
                >
                  <div className="font-manrope p-1">
                    <p className="font-bold text-pasada-dark text-sm">{selectedDriver.plate ?? "ABC 1234"}</p>
                    <p className="text-xs text-pasada-muted">{selectedDriver.driver_name ?? "Driver"}</p>
                    <p className="text-xs text-pasada-warm mt-1">
                      {selectedDriver.occupancy_pct ?? 0}% full · {selectedDriver.current_stop ?? "—"}
                    </p>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <div className="w-full h-full bg-[#f0e8da] flex items-center justify-center">
              <p className="text-pasada-warm text-sm">Add VITE_GOOGLE_MAPS_API_KEY to show map</p>
            </div>
          )}
        </div>

        {/* Side list */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-pasada-muted">
              Active Units ({drivers.length})
            </p>
            <div className="flex items-center gap-2 text-[10px] text-pasada-muted">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-green-500" />Low</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-yellow-500" />Mid</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-500" />High</span>
            </div>
          </div>
          {drivers.length === 0 ? (
            <div className="rounded-2xl bg-white border border-pasada-border p-6 text-center">
              <p className="text-sm text-pasada-muted">No active drivers. Run the seed script.</p>
            </div>
          ) : (
            drivers.map((d) => {
              const pct   = d.occupancy_pct ?? 0;
              const color = occupancyColor(pct);
              return (
                <button
                  key={d.uid}
                  onClick={() => setSelectedDriver(d)}
                  className="rounded-xl bg-white border border-pasada-border p-3 text-left hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-bold text-pasada-dark">{d.plate ?? "ABC 1234"}</p>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: color + "22", color }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <p className="text-xs text-pasada-muted">{d.driver_name ?? "Driver"}</p>
                  <p className="text-xs text-pasada-muted mt-0.5">{d.current_stop ?? "—"} · {d.speed_kmh ?? 0} km/h</p>
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

function FleetPage({ drivers }) {
  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Fleet Management"
        subtitle="Overview of all registered vehicles and their operational status."
        action={<><Plus size={16} />Add Vehicle</>}
      />

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
              const statusStyle = {
                Active:   "bg-green-50 text-green-700",
                "On Area":"bg-yellow-50 text-yellow-700",
                "Off Duty":"bg-gray-100 text-gray-500",
              };
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
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[v.status] ?? "bg-gray-100 text-gray-500"}`}>
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

function DriversPage({ drivers }) {
  const [selected, setSelected] = useState(DRIVERS_SEED[0]);

  const statusStyle = {
    Active:   "bg-green-50 text-green-700 border-green-200",
    "On Area":"bg-yellow-50 text-yellow-700 border-yellow-200",
    "Off Duty":"bg-gray-100 text-gray-500 border-gray-200",
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Driver Roster"
        subtitle="Manage and monitor active fleet personnel across all active routes."
        action={<><Plus size={16} />Add Driver</>}
      />

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
                    <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusStyle[d.status] ?? ""}`}>
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
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-pasada-rust/10 text-xl font-black text-pasada-rust">
                  {selected.name[0]}
                </div>
                <div>
                  <p className="font-bold text-pasada-dark">{selected.name}</p>
                  <p className="text-xs font-mono text-pasada-muted">ID: {selected.id}</p>
                  <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusStyle[selected.status] ?? ""}`}>
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
          </div>
        )}
      </div>
    </div>
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
    <div className="p-8 space-y-6">
      <PageHeader
        title="Route Management"
        subtitle="Monitor active routes, optimize dispatch intervals based on real-time passenger demand, and resolve congestion issues."
        action={<><Plus size={16} />Add New Route</>}
      />

      <div className="mt-6 grid grid-cols-3 gap-6">
        {/* Route cards */}
        <div className="col-span-2 space-y-4">
          {ROUTES_DATA.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.id} className={`rounded-2xl bg-white border-l-4 border border-pasada-border p-5 ${r.demand === "HIGH DEMAND" ? "border-l-red-400" : r.demand === "MODERATE" ? "border-l-yellow-400" : "border-l-green-400"}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-9 items-center justify-center rounded-xl bg-pasada-cream`}>
                      <Icon size={18} className={r.iconColor} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-pasada-dark">{r.from} → {r.to}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.demandColor}`}>
                          {r.demand}
                        </span>
                      </div>
                      <p className="text-xs text-pasada-muted mt-0.5">{r.active} Active Jeepneys</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-pasada-dark">{r.eta}</p>
                    <p className="text-[10px] text-pasada-muted">AVG ETA</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
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

                <div className="flex items-center justify-between">
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
              <div className="w-full h-full bg-[#f0e8da] flex items-center justify-center">
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
  const totalWaiting = passengers.length;

  const stopDemand = stops.map((s) => ({
    name: s.name ?? s.stop ?? s.id,
    count: s.count ?? passengers.filter((p) => p.stop === (s.name ?? s.stop)).length,
    lat: s.lat,
    lng: s.lng,
  }));

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Passenger Demand"
        subtitle="Live waiting passenger counts aggregated by stop and route."
      />

      <div className="mt-6 grid grid-cols-4 gap-4">
        <KpiCard label="Total Waiting"  value={totalWaiting}                  icon={Users}    />
        <KpiCard label="Hottest Stop"   value={stopDemand.sort((a,b)=>b.count-a.count)[0]?.name ?? "—"} icon={MapPin} />
        <KpiCard label="Routes Active"  value="3"                              icon={Navigation} />
        <KpiCard label="Avg Wait Time"  value="6 min"                          icon={Clock}    />
      </div>

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
            {stopDemand.length > 0 ? stopDemand.map((s, i) => {
              const max = Math.max(...stopDemand.map((x) => x.count), 1);
              const pct = Math.round((s.count / max) * 100);
              const color = pct > 70 ? "#D32F2F" : pct > 40 ? "#C2652A" : "#388E3C";
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
            }) : (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-pasada-muted">
                  No stop data. Run the seed script to populate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Analytics Page ─────────────────────────────────────────────────────────────

function AnalyticsPage({ kpis, drivers }) {
  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Fleet performance metrics, revenue trends, and AI-powered insights."
      />

      <div className="mt-6 grid grid-cols-4 gap-4">
        <KpiCard label="Weekly Revenue"   value="₱24,840"  sub="+8% vs last week"  trend="up"   icon={TrendingUp}  />
        <KpiCard label="Total Trips"       value="247"      sub="+15 vs last week"  trend="up"   icon={Navigation}  />
        <KpiCard label="Avg Occupancy"     value={`${kpis.avgOccupancyPct}%`}       sub="fleet average"         icon={Users}       />
        <KpiCard label="Driver Rating"     value="4.7 ★"   sub="avg across fleet"               icon={Star}        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <KPICards kpis={kpis} />
        <AIInsights />
      </div>
    </div>
  );
}

// ── Settings Page ──────────────────────────────────────────────────────────────

function SettingsPage() {
  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Settings" subtitle="System configuration and preferences." />

      <div className="mt-6 max-w-lg space-y-4">
        {[
          { label: "Dispatch Algorithm",   value: "AI-Optimized (v2)"     },
          { label: "Demand Update Interval", value: "30 seconds"           },
          { label: "Map Provider",         value: "Google Maps Platform"  },
          { label: "Notification Channel", value: "Firebase Cloud Messaging" },
          { label: "Route Count",          value: "3 active routes"       },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between rounded-2xl bg-white border border-pasada-border px-5 py-4">
            <div>
              <p className="font-semibold text-pasada-dark">{label}</p>
              <p className="text-xs text-pasada-muted mt-0.5">{value}</p>
            </div>
            <button className="text-xs font-bold text-pasada-rust hover:underline">Edit</button>
          </div>
        ))}
      </div>
    </div>
  );
}
