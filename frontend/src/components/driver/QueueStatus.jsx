/**
 * Displays the seat queue status bar.
 * Props:
 *   jeepId        – string
 *   capacity      – number
 *   onBoard       – number
 *   queued        – number (waiting passengers nearby)
 */
export default function QueueStatus({ jeepId, capacity = 18, onBoard = 0, queued = 0 }) {
  const remaining = capacity - onBoard;
  const fillPct = Math.min((onBoard / capacity) * 100, 100);

  return (
    <div className="rounded-xl bg-white p-4 shadow space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Seat Status — Jeep #{jeepId}
        </span>
        <span className="text-xs text-gray-500">Capacity: {capacity}</span>
      </div>

      {/* Progress bar */}
      <div className="h-3 w-full rounded-full bg-gray-100">
        <div
          className="h-3 rounded-full bg-brand-red transition-all"
          style={{ width: `${fillPct}%` }}
        />
      </div>

      <div className="flex gap-6 text-sm">
        <Stat label="On Board" value={onBoard} color="text-brand-red" />
        <Stat label="Queued" value={queued} color="text-brand-orange" />
        <Stat label="Remaining" value={remaining} color="text-brand-green" />
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="flex flex-col">
      <span className={`text-xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}
