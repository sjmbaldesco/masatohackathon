/**
 * The core CTA — broadcasts or cancels the passenger's waiting status.
 * Props:
 *   isWaiting  – boolean
 *   disabled   – boolean (no stop selected)
 *   onToggle   – fn()
 */
export default function WaitingButton({ isWaiting, disabled, onToggle }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`w-full rounded-2xl py-5 text-lg font-bold tracking-wide shadow-lg transition-all
        ${disabled ? "cursor-not-allowed bg-gray-200 text-gray-400"
          : isWaiting
            ? "bg-brand-orange text-white hover:bg-orange-600 active:scale-95"
            : "bg-brand-red text-white hover:bg-red-700 active:scale-95"
        }`}
    >
      {disabled
        ? "Select a route and stop first"
        : isWaiting
          ? "✅ I'm waiting here — tap to cancel"
          : "🚏 I'm waiting here"}
    </button>
  );
}
