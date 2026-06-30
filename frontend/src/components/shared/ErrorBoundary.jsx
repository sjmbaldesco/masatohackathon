import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("UI crash:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-pasada-cream p-6 font-manrope">
          <div className="max-w-sm w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
            <p className="font-bold text-red-700 text-base">Something went wrong</p>
            <p className="text-sm text-red-600 font-mono break-words">
              {String(this.state.error?.message ?? "Unknown error")}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
