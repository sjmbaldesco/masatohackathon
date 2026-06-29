/**
 * Shows the nearest approaching jeep's ETA, occupancy, and available seats.
 * Props:
 *   jeep – { id, eta_min, occupancy_pct, seats_available } | null
 */
export default function ETACard({ jeep }) {
  if (!jeep) {
    return (
      <div className="rounded-xl bg-white p-4 shadow text-center text-sm text-gray-400">
        No jeep data yet. Broadcast your location to get started.
      </div>
    );
  }

  const occupancyColor =
    jeep.occupancy_pct >= 90
      ? "text-brand-red"
      : jeep.occupancy_pct >= 60
        ? "text-brand-orange"
        : "text-brand-green";

  return (
    <div className="rounded-xl bg-white p-4 shadow space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Next Jeep — {jeep.id}
      </p>
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold text-brand-dark">{jeep.eta_min}</span>
        <span className="pb-1 text-gray-500">min away</span>
      </div>
      <div className="flex gap-4 text-sm">
        <span className={`font-semibold ${occupancyColor}`}>
          {jeep.occupancy_pct}% full
        </span>
        <span className="text-gray-600">{jeep.seats_available} seats left</span>
      </div>
    </div>
  );
}
