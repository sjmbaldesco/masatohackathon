export default function TabBar({ tabs, active, onChange }) {
  return (
    <nav className="flex border-t border-white/10 bg-brand-dark">
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium
              transition-colors ${isActive ? "text-brand-orange" : "text-white/40"}`}
          >
            <Icon
              size={22}
              strokeWidth={isActive ? 2.5 : 1.8}
            />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
