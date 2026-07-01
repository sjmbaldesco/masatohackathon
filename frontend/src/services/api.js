import axios from "axios";
import { auth } from "./firebase";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
});

// Attach Firebase ID token on every request
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Passengers ---
export const broadcastWaiting = (data) =>
  // POST { stop, route, lat, lng }
  api.post("/passengers/waiting", data);

export const cancelWaiting = (passengerId, reason = "cancelled") =>
  // reason: "cancelled" (gave up waiting) | "boarded" (already on a jeepney)
  api.delete(`/passengers/${passengerId}/waiting`, { params: { reason } });

// --- Drivers ---
export const updateDriverGPS = (data) =>
  // POST { lat, lng, occupancy, route }
  api.post("/drivers/gps", data);

export const getDepartureScore = (driverId) =>
  // GET → { score, expected_passengers, expected_revenue, travel_time_min, recommendation }
  api.get(`/drivers/${driverId}/confidence`);

// --- Demand ---
export const getDemandByRoute = (routeId) =>
  // GET → [{ stop, count, lat, lng }, ...]
  api.get(`/demand/${routeId}`);

// --- AI / Dispatcher ---
export const getDispatchRecommendation = (routeId) =>
  // POST → { insight, recommended_action }
  api.post("/ai/dispatch", { route_id: routeId });

export const getPassengerRecommendation = (data) =>
  // POST { stop, route } → { recommendation }
  api.post("/ai/passenger-tip", data);

export const getAnalyticsInsights = (data) =>
  // POST { active_drivers, total_waiting, avg_occupancy_pct, route } → { insights: string[] }
  api.post("/ai/analytics/insights", data, { timeout: 10_000 });

export default api;
