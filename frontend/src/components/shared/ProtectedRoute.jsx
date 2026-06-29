import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "./LoadingSpinner";

/**
 * Wraps a route to require authentication and optionally specific roles.
 * @param {string[]} roles - allowed roles; omit to allow any authenticated user
 */
export default function ProtectedRoute({ children, roles = [] }) {
  const { user, role, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles.length > 0 && !roles.includes(role)) {
    // Redirect to the user's own view instead of 403
    const roleRoutes = { passenger: "/passenger", driver: "/driver", dispatcher: "/coop", admin: "/coop" };
    return <Navigate to={roleRoutes[role] ?? "/login"} replace />;
  }

  return children;
}
