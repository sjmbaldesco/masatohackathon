import { DollarSign, Users, Sparkles, CheckCircle2 } from "lucide-react";

export default function EndTripModal({ onClose, earnings, passengers, tip }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pb-20">
      <div className="absolute inset-0 bg-pasada-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="bg-pasada-rust px-6 py-8 text-center text-white relative">
          {/* Subtle pattern or glow could go here */}
          <div className="absolute inset-0 bg-white/10 opacity-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent"></div>
          
          <div className="relative">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-white text-pasada-rust shadow-lg mb-4">
              <CheckCircle2 size={36} strokeWidth={2.5} />
            </div>
            <h2 className="text-xl font-bold mb-1">Route Completed</h2>
            <p className="text-sm text-pasada-cream font-medium opacity-90">Lumban → Sta. Cruz</p>
          </div>
        </div>
        
        <div className="px-6 py-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-pasada-border bg-pasada-cream p-4 text-center">
              <div className="flex justify-center mb-1 text-pasada-muted">
                <DollarSign size={18} />
              </div>
              <p className="text-[11px] font-bold text-pasada-muted uppercase tracking-wider mb-1">Earnings</p>
              <p className="text-xl font-bold text-pasada-dark">₱ {earnings}</p>
            </div>
            
            <div className="rounded-2xl border border-pasada-border bg-pasada-cream p-4 text-center">
              <div className="flex justify-center mb-1 text-pasada-muted">
                <Users size={18} />
              </div>
              <p className="text-[11px] font-bold text-pasada-muted uppercase tracking-wider mb-1">Passengers</p>
              <p className="text-xl font-bold text-pasada-dark">{passengers}</p>
            </div>
          </div>
          
          <div className="rounded-xl bg-[#F0F7FA] border border-[#BCE1F0] p-4 flex gap-3">
            <Sparkles size={20} className="text-[#0284C7] shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold text-[#0284C7] uppercase tracking-wider mb-0.5">AI Turnaround Advice</p>
              <p className="text-sm font-semibold text-pasada-dark leading-tight">{tip}</p>
            </div>
          </div>

          <button
            data-testid="end-summary-ack-btn"
            onClick={onClose}
            className="w-full rounded-2xl bg-pasada-dark py-4 text-sm font-bold text-white hover:bg-pasada-dark/90 transition-colors shadow-md mt-2"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}
