/**
 * Departure Confidence Score card.
 * Props:
 *   score              – number 0–100 | null (null = not loaded yet)
 *   expectedPassengers – string e.g. "17–18"
 *   travelTimeMin      – number | null
 *   expectedRevenue    – number (PHP) | null
 *   recommendation     – string | null
 *   loading            – boolean
 *   unavailable        – boolean (API down)
 *   onRefresh          – fn()
 */
export default function DepartureScore({
  score = null,
  expectedPassengers = "–",
  travelTimeMin = null,
  expectedRevenue = null,
  recommendation = null,
  loading = false,
  unavailable = false,
  onRefresh,
}) {
  const scoreColor =
    score === null    ? "text-pasada-muted"
    : score >= 75    ? "text-green-500"
    : score >= 50    ? "text-orange-400"
    : "text-pasada-rust";

  return (
    <div className="rounded-2xl bg-pasada-dark text-white p-4 shadow-lg space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
          Departure Confidence
        </span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-[11px] text-white/40 hover:text-white/80 transition disabled:opacity-40"
        >
          {loading ? "…" : "↻ Refresh"}
        </button>
      </div>

      {unavailable ? (
        <p className="text-sm text-white/40 py-1">Backend unavailable — score not loaded.</p>
      ) : (
        <>
          <div className={`text-5xl font-black tracking-tight leading-none ${scoreColor}`}>
            {score !== null ? `${score}%` : "—"}
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <Metric label="Exp. pax"    value={expectedPassengers} />
            <Metric label="Travel time" value={travelTimeMin ? `${travelTimeMin} min` : "—"} />
            <Metric label="Revenue"     value={expectedRevenue ? `₱${expectedRevenue}` : "—"} />
          </div>

          {recommendation && (
            <div
              className={`rounded-xl py-2 text-center text-xs font-bold transition-colors
                ${recommendation === "Depart Now" ? "bg-green-500 text-white" : "bg-white/10 text-white/70"}`}
            >
              {recommendation === "Depart Now" ? "✅ Recommended: Depart Now" : `⏳ ${recommendation}`}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-bold text-white">{value}</span>
      <span className="text-[10px] text-white/40">{label}</span>
    </div>
  );
}
