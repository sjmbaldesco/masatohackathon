import { Routes, Route, Navigate } from "react-router-dom";
import RoleSelect from "./pages/RoleSelect";
import PassengerPage from "./pages/PassengerPage";
import DriverPage from "./pages/DriverPage";
import AdminDashboard from "./pages/AdminDashboard";
import PassengerAdminLogin from "./pages/PassengerAdminLogin";
import DriverLoginPage from "./pages/DriverLoginPage";
import ProtectedRoute from "./components/shared/ProtectedRoute";
import LoadingSpinner from "./components/shared/LoadingSpinner";
import { useAuth } from "./context/AuthContext";

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen message="Initializing AI Systems…" />;
  }

  return (
    <Routes>
      <Route path="/"                  element={<RoleSelect />} />
      <Route path="/login"             element={<Navigate to="/" replace />} />
      <Route path="/login/driver"      element={<DriverLoginPage />} />
      <Route path="/login/:role"       element={<PassengerAdminLogin />} />

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

      <Route path="/coop" element={<Navigate to="/admin" replace />} />
      <Route path="*"     element={<Navigate to="/" replace />} />
    </Routes>
  );
}
