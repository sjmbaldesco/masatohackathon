import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import PassengerPage from "./pages/PassengerPage";
import DriverPage from "./pages/DriverPage";
import CoopDashboard from "./pages/CoopDashboard";
import ProtectedRoute from "./components/shared/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Passenger */}
      <Route
        path="/passenger"
        element={
          <ProtectedRoute roles={["passenger"]}>
            <PassengerPage />
          </ProtectedRoute>
        }
      />

      {/* Driver */}
      <Route
        path="/driver"
        element={
          <ProtectedRoute roles={["driver"]}>
            <DriverPage />
          </ProtectedRoute>
        }
      />

      {/* Cooperative dispatcher */}
      <Route
        path="/coop"
        element={
          <ProtectedRoute roles={["dispatcher", "admin"]}>
            <CoopDashboard />
          </ProtectedRoute>
        }
      />

      {/* Default redirect — role-based routing handled after login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
