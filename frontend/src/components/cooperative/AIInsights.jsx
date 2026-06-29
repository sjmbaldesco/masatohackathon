/**
 * Renders Gemini-powered dispatch insights.
 * Props:
 *   insight    – string | null
 *   action     – string | null
 *   loading    – boolean
 *   onRequest  – fn()
 */
export default function AIInsights({ insight, action, loading, onRequest }) {
  return (
    <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <span className="text-sm font-semibold text-purple-800">AI Insight</span>
        </div>
        <button
          onClick={onRequest}
          disabled={loading}
          className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? "Thinking…" : "Ask Gemini"}
        </button>
      </div>

      {insight ? (
        <p className="text-sm text-purple-900 leading-relaxed">{insight}</p>
      ) : (
        <p className="text-xs text-purple-400">
          No insight yet. Tap "Ask Gemini" to get a dispatch recommendation.
        </p>
      )}

      {action && (
        <div className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white">
          Recommended: {action}
        </div>
      )}
    </div>
  );
}
