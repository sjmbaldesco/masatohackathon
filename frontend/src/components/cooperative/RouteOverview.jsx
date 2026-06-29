/**
 * Route-level summary table for the dispatcher.
 * Props:
 *   routes – [{ id, name, passengerQueue, activeJeeps, recommended }]
 *   onDispatch – fn(routeId)
 */
export default function RouteOverview({ routes = [], onDispatch }) {
  return (
    <div className="rounded-xl bg-white shadow overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">Route</th>
            <th className="px-4 py-3 text-right">Queue</th>
            <th className="px-4 py-3 text-right">Active</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {routes.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                No active routes
              </td>
            </tr>
          )}
          {routes.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50 transition">
              <td className="px-4 py-3 font-medium text-brand-dark">{r.name}</td>
              <td className="px-4 py-3 text-right">
                <span className={`font-semibold ${r.passengerQueue > 20 ? "text-brand-red" : "text-gray-700"}`}>
                  {r.passengerQueue}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-gray-600">{r.activeJeeps}</td>
              <td className="px-4 py-3 text-right">
                {r.recommended ? (
                  <button
                    onClick={() => onDispatch?.(r.id)}
                    className="rounded-lg bg-brand-red px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    Dispatch
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">OK</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
