import { useState } from "react";
import Navbar from "../components/shared/Navbar";
import KPICards from "../components/cooperative/KPICards";
import RouteOverview from "../components/cooperative/RouteOverview";
import AIInsights from "../components/cooperative/AIInsights";
import { useCollection } from "../hooks/useFirestore";
import { getDispatchRecommendation } from "../services/api";

export default function CoopDashboard() {
  const [insight, setInsight] = useState(null);
  const [insightAction, setInsightAction] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);

  const { data: routes } = useCollection("routes");
  const { data: drivers } = useCollection("drivers", [["status", "==", "active"]]);
  const { data: passengers } = useCollection("passengers", [["status", "==", "waiting"]]);

  // Aggregate KPIs from live Firestore data
  const kpis = {
    totalWaiting: passengers.length,
    avgOccupancyPct:
      drivers.length > 0
        ? Math.round(drivers.reduce((s, d) => s + d.occupancy, 0) / drivers.length)
        : null,
    avgWaitMin: null,       // TODO: compute from passenger timestamps
    avgDailyRevenue: null,  // TODO: from historical analytics collection
  };

  // Shape routes for RouteOverview
  const routeRows = routes.map((r) => ({
    id: r.id,
    name: r.name,
    passengerQueue: r.total_waiting ?? 0,
    activeJeeps: r.active_drivers ?? 0,
    recommended: (r.total_waiting ?? 0) > (r.active_drivers ?? 0) * 6, // simple threshold
  }));

  async function handleAIInsight() {
    if (!selectedRoute) return;
    setInsightLoading(true);
    try {
      const res = await getDispatchRecommendation(selectedRoute);
      setInsight(res.data.insight);
      setInsightAction(res.data.recommended_action);
    } catch (e) {
      console.error(e);
    } finally {
      setInsightLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-gray-100">
      <Navbar title="Cooperative Dashboard" />
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        <KPICards kpis={kpis} />
        <AIInsights
          insight={insight}
          action={insightAction}
          loading={insightLoading}
          onRequest={handleAIInsight}
        />
        <RouteOverview
          routes={routeRows}
          onDispatch={(routeId) => {
            setSelectedRoute(routeId);
            handleAIInsight();
          }}
        />
        {/* TODO: Historical analytics charts */}
      </div>
    </div>
  );
}
