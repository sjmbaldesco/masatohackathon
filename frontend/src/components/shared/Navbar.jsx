import { useAuth } from "../../context/AuthContext";

export default function Navbar({ title }) {
  const { user, logout } = useAuth();

  return (
    <nav className="flex items-center justify-between bg-brand-dark px-4 py-3 text-white shadow">
      <span className="text-lg font-bold tracking-tight">
        🚍 Pasada <span className="text-sm font-normal opacity-60">— {title}</span>
      </span>
      <div className="flex items-center gap-3">
        <span className="text-sm opacity-70">{user?.displayName}</span>
        <button
          onClick={logout}
          className="rounded bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
