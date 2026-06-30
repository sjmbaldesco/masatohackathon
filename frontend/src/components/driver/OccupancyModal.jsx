import { useState } from "react";
import { X, Minus, Plus } from "lucide-react";

const QUICK_LEVELS = [
  { label: "EMPTY",       sublabel: "0%",   pct: 0    },
  { label: "QUARTER",     sublabel: "25%",  pct: 0.25 },
  { label: "HALF FULL",   sublabel: "50%",  pct: 0.5  },
  { label: "ALMOST FULL", sublabel: "75%",  pct: 0.75 },
];

function occupancyStatusLabel(pct) {
  if (pct >= 100) return "FULL";
  if (pct >= 75)  return "ALMOST FULL";
  if (pct >= 50)  return "HALF FULL";
  if (pct >= 25)  return "QUARTER FULL";
  return "EMPTY";
}

function occupancyRingColor(pct) {
  if (pct >= 85) return "#D32F2F";
  if (pct >= 50) return "#EF233C";
  return "#388E3C";
}

export default function OccupancyModal({ capacity = 18, currentCount = 0, onSave, onClose }) {
  const [count, setCount] = useState(currentCount);

  function setLevel(pct) {
    setCount(Math.round(capacity * pct));
  }

  const pct   = Math.round((count / capacity) * 100);
  const color = occupancyRingColor(pct);
  const label = occupancyStatusLabel(pct);

  // SVG ring math
  const r            = 54;
  const circumference = 2 * Math.PI * r;
  const strokeOffset  = circumference - (Math.min(pct, 100) / 100) * circumference;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-10 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <h2 className="font-garamond text-2xl font-bold text-pasada-dark leading-tight">
            How full is your jeepney?
          </h2>
          <button
            onClick={onClose}
            className="ml-3 flex size-8 shrink-0 items-center justify-center rounded-full bg-pasada-cream"
          >
            <X size={16} className="text-pasada-warm" />
          </button>
        </div>

        {/* Circular progress ring */}
        <div className="flex flex-col items-center gap-1">
          <div className="relative">
            <svg width="160" height="160" viewBox="0 0 120 120">
              {/* Track */}
              <circle
                cx="60" cy="60" r={r}
                fill="none"
                stroke="#EDF2F4"
                strokeWidth="10"
              />
              {/* Progress */}
              <circle
                cx="60" cy="60" r={r}
                fill="none"
                stroke={color}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
                style={{ transition: "stroke-dashoffset 0.3s ease, stroke 0.3s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-3xl font-black leading-none"
                style={{ color, transition: "color 0.3s ease" }}
              >
                {pct}%
              </span>
              <span className="mt-1 text-[9px] font-bold tracking-widest uppercase text-pasada-muted">
                {label}
              </span>
            </div>
          </div>
          <p className="text-sm text-pasada-muted">
            {count} of {capacity} seats filled
          </p>
        </div>

        {/* Quick level buttons */}
        <div className="grid grid-cols-4 gap-2">
          {QUICK_LEVELS.map(({ label: lbl, sublabel, pct: lvlPct }) => {
            const lvlCount = Math.round(capacity * lvlPct);
            const isActive = lvlCount === count;
            return (
              <button
                key={lbl}
                onClick={() => setLevel(lvlPct)}
                className={`rounded-xl py-2.5 text-center transition
                  ${isActive
                    ? "bg-pasada-rust text-white shadow-sm"
                    : "bg-pasada-cream text-pasada-warm hover:bg-pasada-rust/10"
                  }`}
              >
                <p className="text-[9px] font-bold uppercase leading-tight">{lbl}</p>
                <p className="text-xs font-semibold mt-0.5">{sublabel}</p>
              </button>
            );
          })}
        </div>

        {/* Exact stepper */}
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-pasada-cream px-4 py-3">
          <button
            onClick={() => setCount((c) => Math.max(0, c - 1))}
            className="flex size-11 items-center justify-center rounded-full bg-white shadow-sm border border-pasada-border active:scale-95 transition-transform"
          >
            <Minus size={18} className="text-pasada-warm" />
          </button>
          <div className="text-center">
            <span className="text-4xl font-black text-pasada-dark">{count}</span>
            <span className="text-lg text-pasada-muted">/{capacity}</span>
          </div>
          <button
            onClick={() => setCount((c) => Math.min(capacity, c + 1))}
            className="flex size-11 items-center justify-center rounded-full bg-white shadow-sm border border-pasada-border active:scale-95 transition-transform"
          >
            <Plus size={18} className="text-pasada-warm" />
          </button>
        </div>

        {/* Save */}
        <button
          onClick={() => onSave(count)}
          className="w-full rounded-xl bg-pasada-rust py-4 font-bold text-white shadow-sm hover:bg-pasada-rust/90 transition-colors"
        >
          Save Occupancy
        </button>
      </div>
    </div>
  );
}
