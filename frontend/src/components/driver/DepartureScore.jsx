/**
 * The Killer Feature card — shows the Departure Confidence Score.
 * Props:
 *   score              – number 0–100
 *   expectedPassengers – string e.g. "17–18"
 *   travelTimeMin      – number
 *   expectedRevenue    – number (PHP)
 *   recommendation     – "Depart Now" | "Wait" | "Loading…"
 *   onRefresh          – fn()
 */
export default function DepartureScore({
  score = null,
  expectedPassengers = "–",
  travelTimeMin = null,
  expectedRevenue = null,
  recommendation = null,
  onRefresh,
}) {
  const scoreColor =
    score === null ? "text-gray-300"
    : score >= 75 ? "text-brand-green"
    : score >= 50 ? "text-brand-orange"
    : "text-brand-red";

  return (
    <div className="rounded-xl bg-brand-dark text-white p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
          Departure Confidence
        </span>
        <button
          onClick={onRefresh}
          className="text-xs text-white/40 hover:text-white/80 transition"
        >
          ↻ Refresh
        </button>
      </div>

      <div className={`text-6xl font-black tracking-tight ${scoreColor}`}>
        {score !== null ? `${score}%` : "—"}
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <Metric label="Expected pax" value={expectedPassengers} />
        <Metric label="Travel time" value={travelTimeMin ? `${travelTimeMin} min` : "—"} />
        <Metric label="Revenue" value={expectedRevenue ? `₱${expectedRevenue}` : "—"} />
      </div>

      {recommendation && (
        <div
          className={`rounded-lg py-2 text-center text-sm font-bold
            ${recommendation === "Depart Now" ? "bg-brand-green" : "bg-white/10"}`}
        >
          {recommendation === "Depart Now" ? "✅ Recommended: Depart Now" : `⏳ ${recommendation}`}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-base font-semibold">{value}</span>
      <span className="text-[11px] text-white/40">{label}</span>
    </div>
  );
}
