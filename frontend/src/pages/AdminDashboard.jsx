import { useState } from "react";
import { GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useFirestore";
import { getDispatchRecommendation } from "../services/api";
import { DEFAULT_CENTER, MAPS_API_KEY, occupancyColor } from "../services/maps";
import KPICards from "../components/cooperative/KPICards";
import AIInsights from "../components/cooperative/AIInsights";

const TABS = [
  { id: "dashboard",  label: "Dashboard" },
  { id: "live-ops",   label: "Live Operations" },
  { id: "demand",     label: "Passenger Demand" },
  { id: "analytics",  label: "Analytics" },
  { id: "fleet",      label: "Fleet" },
  { id: "drivers",    label: "Drivers" },
  { id: "routes",     label: "Routes" },
];

const MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
};

export default function AdminDashboard() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState("live-ops");

  const { data: drivers }    = useCollection("drivers");
  const { data: passengers } = useCollection("passengers", [["status", "==", "waiting"]]);
  const { data: stops }      = useCollection("stops");
  const { data: routes }     = useCollection("routes");

  const kpis = {
    totalWaiting: passengers.length,
    avgOccupancyPct:
      drivers.length > 0
        ? Math.round(drivers.reduce((s, d) => s + (d.occupancy_pct ?? 0), 0) / drivers.length)
        : null,
    avgWaitMin: null,
    avgDailyRevenue: null,
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50 font-manrope">
      {/* Top nav */}
      <header className="flex items-center gap-4 border-b border-gray-200 bg-brand-dark px-6 py-3">
        <span className="text-lg font-black text-white mr-2">🚍 Pasada</span>
        <nav className="flex gap-1 overflow-x-auto flex-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition
                ${activeTab === id
                  ? "bg-brand-orange text-white"
                  : "text-white/60 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition ml-2"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">Exit</span>
        </button>
      </header>

      {/* Tab content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "dashboard"  && <DashboardTab kpis={kpis} drivers={drivers} />}
        {activeTab === "live-ops"   && <LiveOpsTab drivers={drivers} stops={stops} />}
        {activeTab === "demand"     && <DemandTab stops={stops} passengers={passengers} />}
        {activeTab === "analytics"  && <AnalyticsTab kpis={kpis} routes={routes} />}
        {activeTab === "fleet"      && <FleetStub drivers={drivers} />}
        {activeTab === "drivers"    && <DriversStub drivers={drivers} />}
        {activeTab === "routes"     && <RoutesStub routes={routes} />}
      </main>
    </div>
  );
}

/* ─── Dashboard (thin) ─────────────────────────────────────────── */
function DashboardTab({ kpis, drivers }) {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <h2 className="text-xl font-bold text-gray-800">Dashboard</h2>
      <KPICards kpis={kpis} />
      <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 320 }}>
        {MAPS_API_KEY ? (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={DEFAULT_CENTER}
            zoom={13}
            options={MAP_OPTIONS}
          >
            {drivers.map((d) =>
              d.lat ? (
                <Marker
                  key={d.id}
                  position={{ lat: d.lat, lng: d.lng }}
                  icon={{
                    path: window.google?.maps?.SymbolPath?.CIRCLE ?? 0,
                    fillColor: occupancyColor(d.occupancy_pct ?? 0),
                    fillOpacity: 1,
                    strokeColor: "#fff",
                    strokeWeight: 2,
                    scale: 10,
                  }}
                />
              ) : null
            )}
          </GoogleMap>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <p className="text-gray-400 text-sm">Map requires VITE_GOOGLE_MAPS_API_KEY</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Live Operations (deep) ─────────────────────────────────────── */
function LiveOpsTab({ drivers, stops }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="h-full flex">
      {/* Map */}
      <div className="flex-1 relative">
        {MAPS_API_KEY ? (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={DEFAULT_CENTER}
            zoom={13}
            options={MAP_OPTIONS}
          >
            {drivers.map((d) =>
              d.lat ? (
                <Marker
                  key={d.id}
                  position={{ lat: d.lat, lng: d.lng }}
                  onClick={() => setSelected(selected?.id === d.id ? null : d)}
                  icon={{
                    path: window.google?.maps?.SymbolPath?.FORWARD_CLOSED_ARROW ?? 0,
                    fillColor: occupancyColor(d.occupancy_pct ?? 0),
                    fillOpacity: 1,
                    strokeColor: "#fff",
                    strokeWeight: 2,
                    scale: 6,
                    rotation: 0,
                  }}
                />
              ) : null
            )}
            {stops.map((s) =>
              s.lat && s.count > 0 ? (
                <Marker
                  key={s.id}
                  position={{ lat: s.lat, lng: s.lng }}
                  label={{
                    text: String(s.count),
                    color: "white",
                    fontSize: "11px",
                    fontWeight: "bold",
                  }}
                  icon={{
                    path: window.google?.maps?.SymbolPath?.CIRCLE ?? 0,
                    fillColor: "#D32F2F",
                    fillOpacity: 0.85,
                    strokeColor: "#fff",
                    strokeWeight: 1.5,
                    scale: 12,
                  }}
                />
              ) : null
            )}
            {selected && (
              <InfoWindow
                position={{ lat: selected.lat, lng: selected.lng }}
                onCloseClick={() => setSelected(null)}
              >
                <div className="text-xs space-y-1 min-w-[120px]">
                  <p className="font-bold">{selected.plate ?? "—"}</p>
                  <p>Occ: {selected.occupancy_count ?? 0}/{selected.capacity ?? 18}</p>
                  <p>Speed: {selected.speed_kmh ?? 0} km/h</p>
                  <p>Stop: {selected.current_stop ?? "—"}</p>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <p className="text-gray-400 text-sm">Map requires VITE_GOOGLE_MAPS_API_KEY</p>
          </div>
        )}
      </div>

      {/* Side list */}
      <aside className="w-72 border-l border-gray-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Active Units</h3>
          <p className="text-xs text-gray-400">{drivers.length} jeep(s) tracked</p>
        </div>
        <div className="divide-y divide-gray-50">
          {drivers.length === 0 && (
            <p className="p-4 text-sm text-gray-400">No active units yet.</p>
          )}
          {drivers.map((d) => {
            const pct = d.occupancy_pct ?? 0;
            const color = occupancyColor(pct);
            return (
              <div
                key={d.id}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setSelected(d)}
              >
                <div
                  className="size-3 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-800 truncate">
                    {d.plate ?? "—"}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {d.current_stop ?? "—"} · {d.speed_kmh ?? 0} km/h
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color }}>
                    {d.occupancy_count ?? 0}/{d.capacity ?? 18}
                  </p>
                  <p className="text-[10px] text-gray-400 capitalize">{d.status ?? "idle"}</p>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

/* ─── Passenger Demand (deep) ─────────────────────────────────────── */
function DemandTab({ stops, passengers }) {
  const sorted = [...stops].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-gray-800">Passenger Demand</h2>
        <span className="text-sm text-gray-400">
          {passengers.length} waiting total
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="text-left px-4 py-3">Stop</th>
              <th className="text-left px-4 py-3">Route</th>
              <th className="text-right px-4 py-3">Waiting</th>
              <th className="text-right px-4 py-3">Demand</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  No demand data yet
                </td>
              </tr>
            )}
            {sorted.map((s) => {
              const count = s.count ?? 0;
              const pct = Math.min(100, count * 10);
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.name ?? s.stop ?? s.id}</td>
                  <td className="px-4 py-3 text-gray-400">{s.route ?? "R01"}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-brand-red">{count}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-24 h-2 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-brand-red"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Analytics (deep) ─────────────────────────────────────────── */
function AnalyticsTab({ kpis, routes }) {
  const [insight, setInsight] = useState(null);
  const [action, setAction] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetchInsight() {
    setLoading(true);
    try {
      const res = await getDispatchRecommendation("R01");
      setInsight(res.data.insight);
      setAction(res.data.recommended_action);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const metrics = [
    { label: "Waiting Now", value: kpis.totalWaiting ?? 0, unit: "passengers", accent: "text-brand-red" },
    { label: "Avg Occupancy", value: kpis.avgOccupancyPct != null ? `${kpis.avgOccupancyPct}%` : "—", accent: "text-brand-orange" },
    { label: "Avg Wait", value: "~8 min", accent: "text-brand-green" },
    { label: "Avg Revenue", value: "₱1,180/unit", accent: "text-brand-green" },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <h2 className="text-xl font-bold text-gray-800">Analytics</h2>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map(({ label, value, unit, accent }) => (
          <div key={label} className="rounded-xl bg-white border border-gray-200 p-4">
            <p className={`text-2xl font-black ${accent}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-1">{label}</p>
            {unit && <p className="text-[11px] text-gray-300">{unit}</p>}
          </div>
        ))}
      </div>

      {/* Gemini dispatch insight */}
      <AIInsights
        insight={insight}
        action={action}
        loading={loading}
        onRequest={fetchInsight}
      />

      {/* Route summary */}
      <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Route Summary</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="text-left px-4 py-3">Route</th>
              <th className="text-right px-4 py-3">Active Jeeps</th>
              <th className="text-right px-4 py-3">Waiting</th>
            </tr>
          </thead>
          <tbody>
            {routes.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                  No routes seeded yet
                </td>
              </tr>
            ) : (
              routes.map((r) => (
                <tr key={r.id} className="border-t border-gray-50">
                  <td className="px-4 py-3 font-medium">{r.name ?? r.id}</td>
                  <td className="px-4 py-3 text-right">{r.active_drivers ?? 0}</td>
                  <td className="px-4 py-3 text-right text-brand-red">{r.total_waiting ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Stub tabs ─────────────────────────────────────────────────── */
const SEED_FLEET = [
  { plate: "ABC 1234", route: "Lumban → Sta. Cruz", capacity: 18, status: "Active" },
  { plate: "XYZ 5678", route: "Lumban → Sta. Cruz", capacity: 18, status: "Idle" },
];

function FleetStub({ drivers }) {
  const rows = drivers.length > 0
    ? drivers.map((d) => ({ plate: d.plate ?? "—", route: "Lumban → Sta. Cruz", capacity: d.capacity ?? 18, status: d.status ?? "idle" }))
    : SEED_FLEET;

  return (
    <StubTable
      title="Fleet Management"
      subtitle="Unit inventory"
      headers={["Plate", "Route", "Capacity", "Status"]}
      rows={rows.map((r) => [r.plate, r.route, `${r.capacity} seats`, r.status])}
    />
  );
}

function DriversStub({ drivers }) {
  const rows = drivers.length > 0
    ? drivers.map((d) => ({ name: d.driver_name ?? "—", plate: d.plate ?? "—", route: "Lumban → Sta. Cruz", status: d.status ?? "idle" }))
    : [{ name: "J. Dela Cruz", plate: "ABC 1234", route: "Lumban → Sta. Cruz", status: "active" }];

  return (
    <StubTable
      title="Driver Roster"
      subtitle="Registered drivers"
      headers={["Name", "Plate", "Route", "Status"]}
      rows={rows.map((r) => [r.name, r.plate, r.route, r.status])}
    />
  );
}

function RoutesStub({ routes }) {
  const rows = routes.length > 0
    ? routes.map((r) => ({ name: r.name ?? r.id, origin: r.origin ?? "—", dest: r.destination ?? "—", fare: r.fare_base ?? 13 }))
    : [{ name: "Lumban → Sta. Cruz", origin: "Lumban", dest: "Sta. Cruz", fare: 13 }];

  return (
    <StubTable
      title="Routes"
      subtitle="Service routes"
      headers={["Route", "From", "To", "Base Fare"]}
      rows={rows.map((r) => [r.name, r.origin, r.dest, `₱${r.fare}`])}
    />
  );
}

function StubTable({ title, subtitle, headers, rows }) {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        <p className="text-sm text-gray-400">{subtitle}</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              {headers.map((h) => (
                <th key={h} className="text-left px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3 text-gray-800 capitalize">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
