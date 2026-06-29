import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bus, User, LayoutDashboard } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const ROLES = [
  {
    id: "driver",
    label: "Driver",
    icon: Bus,
    description: "Manage your route, occupancy, and earnings",
    accent: "bg-brand-orange",
  },
  {
    id: "passenger",
    label: "Passenger",
    icon: User,
    description: "Track jeepneys and broadcast your wait",
    accent: "bg-brand-green",
  },
  {
    id: "admin",
    label: "Admin",
    icon: LayoutDashboard,
    description: "Monitor live operations and demand",
    accent: "bg-brand-red",
  },
];

const ROLE_ROUTES = {
  driver: "/driver",
  passenger: "/passenger",
  admin: "/admin",
};

export default function RoleSelect() {
  const { user, role, loading, selectRole } = useAuth();
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-dark px-6 py-10">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="text-5xl">🚍</div>
          <h1 className="mt-3 text-4xl font-black text-white tracking-tight">Pasada</h1>
          <p className="mt-1 text-sm text-white/50">Know when to ride. Know when to leave.</p>
        </div>

        {/* Role cards */}
        <div className="space-y-3">
          <p className="text-center text-xs uppercase tracking-widest text-white/30">
            Select your role
          </p>
          {ROLES.map(({ id, label, icon: Icon, description, accent }) => (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              disabled={!!selecting}
              className="flex w-full items-center gap-4 rounded-2xl bg-white/10 px-5 py-4 text-left
                hover:bg-white/[0.15] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <div
                className={`flex size-11 shrink-0 items-center justify-center rounded-full ${accent}`}
              >
                <Icon size={20} className="text-white" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-white text-[15px]">{label}</p>
                <p className="text-xs text-white/50 mt-0.5">{description}</p>
              </div>
              {selecting === id && (
                <div className="size-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              )}
            </button>
          ))}
        </div>

        {/* Demo switch hint */}
        <p className="text-center text-[11px] text-white/20">
          Demo mode · tap to switch roles at any time
        </p>
      </div>
    </div>
  );
}
