/**
 * Live KPI strip for the cooperative dashboard.
 * Props:
 *   kpis – { avgWaitMin, avgOccupancyPct, avgDailyRevenue, totalWaiting }
 */
export default function KPICards({ kpis = {} }) {
  const cards = [
    { label: "Avg Wait", value: kpis.avgWaitMin != null ? `${kpis.avgWaitMin} min` : "—", icon: "⏱" },
    { label: "Avg Occupancy", value: kpis.avgOccupancyPct != null ? `${kpis.avgOccupancyPct}%` : "—", icon: "🪑" },
    { label: "Avg Daily Revenue", value: kpis.avgDailyRevenue != null ? `₱${kpis.avgDailyRevenue}` : "—", icon: "💰" },
    { label: "Waiting Now", value: kpis.totalWaiting ?? "—", icon: "🚏" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl bg-white p-4 shadow flex flex-col gap-1">
          <span className="text-xl">{c.icon}</span>
          <span className="text-2xl font-bold text-brand-dark">{c.value}</span>
          <span className="text-xs text-gray-400">{c.label}</span>
        </div>
      ))}
    </div>
  );
}
