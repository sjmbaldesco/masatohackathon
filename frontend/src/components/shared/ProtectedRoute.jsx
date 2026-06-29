import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "./LoadingSpinner";

const ROLE_ROUTES = {
  passenger: "/passenger",
  driver: "/driver",
  admin: "/admin",
};

export default function ProtectedRoute({ children, roles = [] }) {
  const { role, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  // Gate on role — set synchronously by selectRole before navigation
  if (!role) return <Navigate to="/" replace />;
  if (roles.length > 0 && !roles.includes(role)) {
    return <Navigate to={ROLE_ROUTES[role] ?? "/"} replace />;
  }

  return children;
}
