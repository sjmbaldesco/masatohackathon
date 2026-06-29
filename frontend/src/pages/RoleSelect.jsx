import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bus, User, LayoutDashboard, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const ROLES = [
  {
    id: "driver",
    label: "Driver",
    icon: Bus,
    description: "Manage your route, occupancy & trips",
    color: "#C2652A",
  },
  {
    id: "passenger",
    label: "Passenger",
    icon: User,
    description: "Track jeepneys, broadcast your wait",
    color: "#2E7D85",
  },
  {
    id: "admin",
    label: "Admin / Cooperative",
    icon: LayoutDashboard,
    description: "Live operations & fleet oversight",
    color: "#5C4A3A",
  },
];

const ROLE_ROUTES = {
  driver: "/driver",
  passenger: "/passenger",
  admin: "/admin",
};

export default function RoleSelect() {
  const { user, role, loading, authError, selectRole } = useAuth();
  const navigate = useNavigate();
  const [selecting, setSelecting] = useState(null);

  useEffect(() => {
    if (!loading && user && role) {
      navigate(ROLE_ROUTES[role] ?? "/passenger", { replace: true });
    }
  }, [user, role, loading, navigate]);

  async function handleSelect(roleId) {
    setSelecting(roleId);
    try {
      await selectRole(roleId);
      navigate(ROLE_ROUTES[roleId], { replace: true });
    } catch {
      setSelecting(null);
    }
  }

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
          {ROLES.map(({ id, label, icon: Icon, description, color }) => (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              disabled={!!selecting}
              className="flex w-full items-center gap-4 rounded-2xl bg-white shadow-sm border border-pasada-border px-4 py-4 text-left hover:shadow-md active:scale-[0.99] transition-all disabled:opacity-50"
            >
              <div
                className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: color + "1A" }}
              >
                {selecting === id ? (
                  <div
                    className="size-5 rounded-full border-[2.5px] animate-spin"
                    style={{
                      borderColor: color + "44",
                      borderTopColor: color,
                    }}
                  />
                ) : (
                  <Icon size={22} style={{ color }} strokeWidth={1.8} />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-pasada-dark text-[15px]">{label}</p>
                <p className="text-xs text-pasada-muted mt-0.5">{description}</p>
              </div>
              <ChevronRight size={18} className="text-pasada-muted/60 shrink-0" />
            </button>
          ))}
        </div>

        {/* Auth error */}
        {authError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 leading-relaxed">
            {authError}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[11px] text-pasada-muted/60">
          Version 2.0 Beta · Pasada
        </p>
      </div>
    </div>
  );
}
