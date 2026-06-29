import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ROLE_ROUTES = {
  passenger: "/passenger",
  driver: "/driver",
  dispatcher: "/coop",
  admin: "/coop",
};

export default function LoginPage() {
  const { user, role, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && role) {
      navigate(ROLE_ROUTES[role] ?? "/passenger", { replace: true });
    }
  }, [user, role, loading, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-dark px-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <p className="text-5xl">🚍</p>
          <h1 className="mt-3 text-4xl font-black text-white tracking-tight">Pasada</h1>
          <p className="mt-1 text-sm text-white/50">Know when to ride. Know when to leave.</p>
        </div>

        <button
          onClick={signInWithGoogle}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 font-semibold text-gray-800 shadow-lg hover:bg-gray-100 active:scale-95 transition"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
          Continue with Google
        </button>

        <p className="text-xs text-white/30">
          By signing in you agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}
