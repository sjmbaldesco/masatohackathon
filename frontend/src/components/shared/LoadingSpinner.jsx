export default function LoadingSpinner({ message = "Loading…" }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-red" />
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
}
