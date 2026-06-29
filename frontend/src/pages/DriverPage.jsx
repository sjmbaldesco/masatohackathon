import { useState, useEffect } from "react";
import Navbar from "../components/shared/Navbar";
import DemandHeatmap from "../components/driver/DemandHeatmap";
import QueueStatus from "../components/driver/QueueStatus";
import DepartureScore from "../components/driver/DepartureScore";
import { useCollection } from "../hooks/useFirestore";
import { useGPS } from "../hooks/useGPS";
import { updateDriverGPS, getDepartureScore, getDemandByRoute } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function DriverPage() {
  const { user } = useAuth();
  const [scoreData, setScoreData] = useState(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [demandPoints, setDemandPoints] = useState([]);

  // Driver profile from Firestore (route, capacity, etc.)
  const { data: driverDocs } = useCollection("drivers", [["uid", "==", user.uid]]);
  const driverProfile = driverDocs?.[0] ?? {};

  // Push GPS to backend every 7.5s
  const { position } = useGPS(async (coords) => {
    await updateDriverGPS({
      lat: coords.lat,
      lng: coords.lng,
      occupancy: driverProfile.occupancy ?? 0,
      route: driverProfile.route ?? "",
    });
  }, 7500);

  // Live demand along driver's route
  useEffect(() => {
    if (!driverProfile.route) return;
    getDemandByRoute(driverProfile.route)
      .then((res) => setDemandPoints(res.data))
      .catch(console.error);
  }, [driverProfile.route]);

  async function fetchScore() {
    setScoreLoading(true);
    try {
      const res = await getDepartureScore(user.uid);
      setScoreData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setScoreLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Navbar title="Driver" />

      {/* Map: full height minus overlay */}
      <div className="relative flex-1">
        <div className="absolute inset-0">
          <DemandHeatmap demandPoints={demandPoints} driverPosition={position} />
        </div>

        {/* Side panel (mobile: bottom drawer, desktop: right rail) */}
        <div className="absolute bottom-0 left-0 right-0 space-y-3 rounded-t-3xl bg-gray-50 p-4 shadow-xl md:bottom-auto md:right-4 md:top-4 md:w-80 md:rounded-xl">
          <DepartureScore
            score={scoreData?.score ?? null}
            expectedPassengers={scoreData?.expected_passengers}
            travelTimeMin={scoreData?.travel_time_min}
            expectedRevenue={scoreData?.expected_revenue}
            recommendation={scoreData?.recommendation}
            onRefresh={fetchScore}
          />
          <QueueStatus
            jeepId={driverProfile.driver_id}
            capacity={driverProfile.capacity ?? 18}
            onBoard={driverProfile.occupancy ?? 0}
            queued={demandPoints.reduce((sum, p) => sum + p.count, 0)}
          />
        </div>
      </div>
    </div>
  );
}
