import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Bus, ArrowRight, CreditCard, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function DriverLoginPage() {
  const { signInAsDriver, authError, setAuthError } = useAuth();
  const navigate = useNavigate();

  const [driverId, setDriverId] = useState("");
  const [pin,      setPin]      = useState("");
  const [showPin,  setShowPin]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await signInAsDriver(driverId, pin);
      navigate("/driver", { replace: true });
    } catch {
      // authError set by context
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-pasada-cream px-5 py-8 font-manrope">
      {/* Top logo */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-pasada-rust/10">
            <Bus size={18} className="text-pasada-rust" strokeWidth={1.8} />
          </div>
          <span className="font-garamond text-xl font-bold tracking-[0.15em] text-pasada-rust uppercase">
            Pasada
          </span>
        </div>
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-pasada-muted">
          Driver System
        </p>
      </div>

      {/* Main content */}
      <div className="w-full max-w-sm space-y-6 -mt-6">
        <div className="space-y-2 text-center">
          <h1 className="font-garamond text-4xl font-bold text-pasada-dark">Driver Login</h1>
          <p className="text-sm text-pasada-muted leading-relaxed px-4">
            Sign in using the Driver ID provided by your transport cooperative or administrator.
          </p>
        </div>

        {/* Error */}
        {authError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 leading-relaxed">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Driver ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-pasada-muted">
              Driver ID
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-pasada-border bg-white px-3 py-3 focus-within:border-pasada-rust focus-within:ring-1 focus-within:ring-pasada-rust transition">
              <div className="flex size-9 items-center justify-center rounded-lg bg-pasada-cream shrink-0">
                <CreditCard size={18} className="text-pasada-rust" />
              </div>
              <input
                type="text"
                value={driverId}
                onChange={(e) => { setDriverId(e.target.value.toUpperCase()); setAuthError(null); }}
                placeholder="Enter your Driver ID (e.g. DRV-01482)"
                required
                className="flex-1 bg-transparent text-sm text-pasada-dark placeholder-pasada-muted outline-none"
              />
            </div>
          </div>

          {/* PIN */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-pasada-muted">
              PIN
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-pasada-border bg-white px-3 py-3 focus-within:border-pasada-rust focus-within:ring-1 focus-within:ring-pasada-rust transition">
              <div className="flex size-9 items-center justify-center rounded-lg bg-pasada-cream shrink-0">
                <Lock size={18} className="text-pasada-rust" />
              </div>
              <input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/, "")); setAuthError(null); }}
                placeholder="Enter your 6-digit PIN"
                maxLength={6}
                inputMode="numeric"
                required
                className="flex-1 bg-transparent text-sm text-pasada-dark placeholder-pasada-muted outline-none tracking-widest"
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="text-pasada-muted hover:text-pasada-warm transition-colors"
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Start Shift */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-pasada-rust py-4 text-sm font-bold text-white hover:bg-pasada-rust/90 disabled:opacity-60 transition-colors mt-2"
          >
            {loading ? (
              <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <>Start Shift <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        {/* Help link */}
        <div className="text-center space-y-1">
          <p className="text-sm text-pasada-muted">Need help accessing your account?</p>
          <button className="text-sm font-semibold text-pasada-rust hover:underline flex items-center gap-1 mx-auto">
            Contact Administrator
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Info box */}
        <div className="flex gap-3 rounded-2xl bg-pasada-rust/8 border border-pasada-rust/15 p-4" style={{ backgroundColor: "rgba(194,101,42,0.06)" }}>
          <ShieldCheck size={20} className="text-pasada-rust shrink-0 mt-0.5" />
          <p className="text-sm text-pasada-warm leading-relaxed">
            Driver accounts are created and managed by the Transport Operations Center. Contact your administrator if you need a new Driver ID or PIN.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center space-y-0.5">
        <p className="text-[11px] text-pasada-muted">v1.0.0</p>
        <p className="text-[11px] font-semibold text-pasada-rust">Pasada Driver</p>
        <p className="text-[11px] text-pasada-muted/60">© Pasada Transportation System</p>
      </div>
    </div>
  );
}
