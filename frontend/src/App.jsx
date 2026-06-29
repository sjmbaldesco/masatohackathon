import { Routes, Route, Navigate } from "react-router-dom";
import RoleSelect from "./pages/RoleSelect";
import PassengerPage from "./pages/PassengerPage";
import DriverPage from "./pages/DriverPage";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./components/shared/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleSelect />} />
      <Route path="/login" element={<Navigate to="/" replace />} />

      <Route
        path="/passenger"
        element={
          <ProtectedRoute roles={["passenger"]}>
            <PassengerPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/driver"
        element={
          <ProtectedRoute roles={["driver"]}>
            <DriverPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Legacy coop route */}
      <Route path="/coop" element={<Navigate to="/admin" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
