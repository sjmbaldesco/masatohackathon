import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bus, User, LayoutDashboard, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const ROLES = [
  {
    id: "driver",
    label: "Driver",
    icon: Bus,
    description: "Sign in with your Driver ID and PIN",
    color: "#C2652A",
    loginPath: "/login/driver",
  },
  {
    id: "passenger",
    label: "Passenger",
    icon: User,
    description: "Sign in with email or Google",
    color: "#2E7D85",
    loginPath: "/login/passenger",
  },
  {
    id: "admin",
    label: "Admin / Cooperative",
    icon: LayoutDashboard,
    description: "Sign in with email or Google",
    color: "#5C4A3A",
    loginPath: "/login/admin",
  },
];

const ROLE_ROUTES = {
  driver: "/driver",
  passenger: "/passenger",
  admin: "/admin",
};

export default function RoleSelect() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && role) {
      navigate(ROLE_ROUTES[role] ?? "/passenger", { replace: true });
    }
  }, [user, role, loading, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-pasada-cream px-6 py-10 font-manrope">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-[72px] items-center justify-center rounded-full bg-pasada-rust/10">
            <Bus size={34} className="text-pasada-rust" strokeWidth={1.8} />
          </div>
          <div className="text-center">
            <h1 className="font-garamond text-[42px] font-bold leading-tight text-pasada-dark">
              Pasada
            </h1>
            <p className="mt-0.5 text-[11px] font-semibold tracking-[0.18em] uppercase text-pasada-muted">
              Transport Ops
            </p>
          </div>
        </div>

        {/* Role cards */}
        <div className="space-y-3">
          {ROLES.map(({ id, label, icon: Icon, description, color, loginPath }) => (
            <button
              key={id}
              onClick={() => navigate(loginPath)}
              className="flex w-full items-center gap-4 rounded-2xl bg-white shadow-sm border border-pasada-border px-4 py-4 text-left hover:shadow-md active:scale-[0.99] transition-all"
            >
              <div
                className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: color + "1A" }}
              >
                <Icon size={22} style={{ color }} strokeWidth={1.8} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-pasada-dark text-[15px]">{label}</p>
                <p className="text-xs text-pasada-muted mt-0.5">{description}</p>
              </div>
              <ChevronRight size={18} className="text-pasada-muted/60 shrink-0" />
            </button>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-pasada-muted/60">
          Version 2.0 Beta · Pasada
        </p>
      </div>
    </div>
  );
}
