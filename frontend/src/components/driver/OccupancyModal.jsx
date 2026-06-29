import { useState } from "react";
import { X, Minus, Plus } from "lucide-react";

const QUICK_LEVELS = [
  { label: "25%", pct: 0.25 },
  { label: "50%", pct: 0.50 },
  { label: "70%", pct: 0.70 },
  { label: "100%", pct: 1.00 },
];

export default function OccupancyModal({ capacity = 18, currentCount = 0, onSave, onClose }) {
  const [count, setCount] = useState(currentCount);

  function setLevel(pct) {
    setCount(Math.round(capacity * pct));
  }

  const pct = Math.round((count / capacity) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 space-y-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Update Occupancy</h2>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-gray-100"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Quick levels */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Quick set
          </p>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_LEVELS.map(({ label, pct: lvlPct }) => {
              const lvlCount = Math.round(capacity * lvlPct);
              const isActive = lvlCount === count;
              return (
                <button
                  key={label}
                  onClick={() => setLevel(lvlPct)}
                  className={`rounded-xl py-3 text-sm font-bold transition
                    ${isActive
                      ? "bg-brand-orange text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Exact stepper */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Exact count
          </p>
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => setCount((c) => Math.max(0, c - 1))}
              className="flex size-12 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
            >
              <Minus size={18} className="text-gray-700" />
            </button>

            <div className="flex-1 text-center">
              <span className="text-5xl font-black text-gray-900">{count}</span>
              <span className="text-xl text-gray-400">/{capacity}</span>
              <p className="mt-1 text-xs text-gray-400">{pct}% full</p>
            </div>

            <button
              onClick={() => setCount((c) => Math.min(capacity, c + 1))}
              className="flex size-12 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
            >
              <Plus size={18} className="text-gray-700" />
            </button>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={() => onSave(count)}
          className="w-full rounded-xl bg-brand-orange py-4 font-bold text-white shadow"
        >
          Save Occupancy
        </button>
      </div>
    </div>
  );
}
