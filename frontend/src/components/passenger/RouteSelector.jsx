/**
 * Lets the passenger pick their route and boarding stop.
 * Props:
 *   routes      – [{ id, name, stops[] }]
 *   selected    – { routeId, stop }
 *   onChange    – fn({ routeId, stop })
 */
export default function RouteSelector({ routes = [], selected, onChange }) {
  const currentRoute = routes.find((r) => r.id === selected?.routeId);

  return (
    <div className="space-y-3 rounded-xl bg-white p-4 shadow">
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Route
        </label>
        <select
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
          value={selected?.routeId ?? ""}
          onChange={(e) => onChange({ routeId: e.target.value, stop: "" })}
        >
          <option value="">Select a route…</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {currentRoute && (
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Boarding Stop
          </label>
          <select
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
            value={selected?.stop ?? ""}
            onChange={(e) => onChange({ ...selected, stop: e.target.value })}
          >
            <option value="">Select your stop…</option>
            {currentRoute.stops.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
