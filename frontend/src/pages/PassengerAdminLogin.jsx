import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Eye, EyeOff, Bus, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const ROLE_ROUTES = { passenger: "/passenger", admin: "/admin" };

export default function PassengerAdminLogin() {
  const { role } = useParams(); // "passenger" | "admin"
  const { signInWithEmail, signInWithGoogle, authError, setAuthError } = useAuth();
  const navigate = useNavigate();

  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [keepMe,    setKeepMe]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const dest = ROLE_ROUTES[role] ?? "/passenger";

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmail(email, password, role);
      navigate(dest, { replace: true });
    } catch {
      // authError set by context
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleBusy(true);
    try {
      await signInWithGoogle(role);
      navigate(dest, { replace: true });
    } catch {
      // authError set by context
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-pasada-cream px-5 py-8 font-manrope">
      {/* Top logo */}
      <div className="flex items-center gap-2 self-start">
        <div className="flex size-8 items-center justify-center rounded-lg bg-pasada-rust/10">
          <Bus size={18} className="text-pasada-rust" strokeWidth={1.8} />
        </div>
        <span className="font-garamond text-xl font-bold tracking-wide text-pasada-rust">
          PASADA
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-lg border border-pasada-border p-7 space-y-5 -mt-4">
        <div className="space-y-1">
          <h1 className="font-garamond text-3xl font-bold text-pasada-dark">Welcome Back</h1>
          <p className="text-sm text-pasada-muted">Sign in to access your transit dashboard.</p>
        </div>

        {/* Error */}
        {authError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 leading-relaxed">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-pasada-dark">
              Email or Phone Number
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setAuthError(null); }}
              placeholder="Enter your email or phone"
              required
              className="w-full rounded-xl border border-pasada-border bg-pasada-cream/50 px-4 py-3 text-sm text-pasada-dark placeholder-pasada-muted outline-none focus:border-pasada-rust focus:ring-1 focus:ring-pasada-rust transition"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-pasada-dark">Password</label>
              <button type="button" className="text-xs font-semibold text-pasada-rust hover:underline">
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setAuthError(null); }}
                placeholder="Enter your password"
                required
                className="w-full rounded-xl border border-pasada-border bg-pasada-cream/50 px-4 py-3 pr-11 text-sm text-pasada-dark placeholder-pasada-muted outline-none focus:border-pasada-rust focus:ring-1 focus:ring-pasada-rust transition"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-pasada-muted hover:text-pasada-warm"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Keep me signed in */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={keepMe}
              onChange={(e) => setKeepMe(e.target.checked)}
              className="size-4 rounded border-pasada-border accent-pasada-rust"
            />
            <span className="text-sm text-pasada-warm">Keep me signed in</span>
          </label>

          {/* Sign In */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-pasada-rust py-3.5 text-sm font-bold text-white hover:bg-pasada-rust/90 disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <>Sign In <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-pasada-border" />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-pasada-muted">
            or continue with
          </span>
          <div className="flex-1 h-px bg-pasada-border" />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={googleBusy}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-pasada-border bg-white py-3 text-sm font-semibold text-pasada-dark hover:bg-pasada-cream/60 disabled:opacity-60 transition-colors shadow-sm"
        >
          {googleBusy ? (
            <span className="size-4 rounded-full border-2 border-pasada-muted/40 border-t-pasada-rust animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Login with Google
        </button>
      </div>

      {/* Footer */}
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center gap-5 text-[11px] font-semibold uppercase tracking-wide text-pasada-muted">
          <button className="hover:text-pasada-rust transition-colors">Privacy Policy</button>
          <button className="hover:text-pasada-rust transition-colors">Terms of Service</button>
          <button className="hover:text-pasada-rust transition-colors">Help Center</button>
        </div>
        <p className="text-[11px] text-pasada-muted/60">
          © 2024 Pasada Transit Authority. All rights reserved.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
