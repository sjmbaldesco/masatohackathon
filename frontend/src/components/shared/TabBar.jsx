export default function TabBar({ tabs, active, onChange }) {
  return (
    <nav
      className="flex border-t border-pasada-border bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            data-testid={`tab-${id}`}
            onClick={() => onChange(id)}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-semibold transition-colors
              ${isActive ? "text-pasada-rust" : "text-pasada-muted"}`}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className="tracking-wide">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
