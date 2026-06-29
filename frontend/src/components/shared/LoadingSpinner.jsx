import { Bus } from "lucide-react";

export default function LoadingSpinner({ message = "Loading…", fullScreen = false }) {
  if (fullScreen) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-pasada-cream font-manrope">
        <div className="flex flex-col items-center gap-5">
          <div className="flex size-[72px] items-center justify-center rounded-full bg-pasada-rust/10">
            <Bus size={34} className="text-pasada-rust" strokeWidth={1.8} />
          </div>
          <h1 className="font-garamond text-[42px] font-bold text-pasada-dark leading-none">
            Pasada
          </h1>
          <div className="flex flex-col items-center gap-2">
            <div className="size-9 rounded-full border-[3px] border-pasada-cream/80 border-t-pasada-rust animate-spin" />
            <p className="text-sm text-pasada-muted">{message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="size-9 rounded-full border-[3px] border-pasada-cream/60 border-t-pasada-rust animate-spin" />
        <p className="text-sm text-pasada-muted">{message}</p>
      </div>
    </div>
  );
}
