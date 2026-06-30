import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "./LoadingSpinner";

const ROLE_ROUTES = {
  passenger: "/passenger",
  driver:    "/driver",
  admin:     "/admin",
};

const norm = (r) => (r ?? "").toString().trim().toLowerCase();

export default function ProtectedRoute({ children, roles = [] }) {
  const { user, role, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user)   return <Navigate to="/" replace />;

  if (roles.length > 0 && !roles.map(norm).includes(norm(role))) {
    return <Navigate to={ROLE_ROUTES[norm(role)] ?? "/"} replace />;
  }

  return children;
}
