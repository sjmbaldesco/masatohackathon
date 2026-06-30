import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Menu, MessageSquare, Users, Gauge, MapPin, UserPlus, Flag } from "lucide-react";

// Custom driver location marker icon
const driverIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:48px;height:48px;
    background:rgba(194,101,42,0.2);
    border-radius:50%;
    display:flex;align-items:center;justify-content:center;
  ">
    <div style="
      width:32px;height:32px;
      background:#EF233C;
      border:2.5px solid white;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 6px -1px rgba(0,0,0,0.2);
    ">
      <svg width="14" height="12" viewBox="0 0 14 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.5 7.5L2.5 3.5H11.5L12.5 7.5" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>
        <rect x="1" y="7" width="12" height="4" rx="1" fill="white" fill-opacity="0.9"/>
        <circle cx="3.5" cy="11" r="1" fill="white"/>
        <circle cx="10.5" cy="11" r="1" fill="white"/>
      </svg>
    </div>
  </div>`,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

function RecenterMap({ position }) {
  const map = useMap();
  if (position) map.setView([position.lat, position.lng], map.getZoom());
  return null;
}

function TripHeader({ routeLabel, onMenuOpen, onChatOpen }) {
  return (
    <header className="absolute left-0 right-0 top-0 z-[1000] flex items-center justify-between px-6 py-4 backdrop-blur-sm bg-pasada-overlay">
      <button
        onClick={onMenuOpen}
        className="flex size-10 items-center justify-center rounded-full bg-[#f2ece4]"
        aria-label="Menu"
      >
        <Menu size={18} strokeWidth={2} className="text-pasada-dark" />
      </button>

      <div className="flex flex-col items-center pb-4">
        <h1 className="font-garamond text-[20px] font-bold leading-7 tracking-[-0.5px] text-pasada-rust">
          {routeLabel}
        </h1>
      </div>

      <button
        onClick={onChatOpen}
        className="flex size-10 items-center justify-center rounded-full bg-pasada-rust-light"
        aria-label="Quick stats or chat"
      >
        <MessageSquare size={18} strokeWidth={2} className="text-pasada-rust" />
      </button>
    </header>
  );
}

function HUDCard({ icon: Icon, iconBg, label, primary, secondary }) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl border border-pasada-border bg-pasada-card p-[13px] shadow-sm backdrop-blur-xs">
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-full"
        style={{ background: iconBg }}
      >
        <Icon size={18} strokeWidth={2} className="text-pasada-dark" />
      </div>
      <div>
        <p className="font-manrope text-[11px] font-normal uppercase tracking-[0.6px] text-pasada-warm">
          {label}
        </p>
        <p className="font-bold leading-none mt-1">
          <span className="font-garamond text-[20px] text-pasada-dark">{primary}</span>
          <span className="font-manrope text-[14px] text-pasada-muted">{secondary}</span>
        </p>
      </div>
    </div>
  );
}

function NextStopPill({ stopName, etaMin }) {
  return (
    <div className="mt-4 inline-flex items-center gap-3 rounded-full border border-pasada-border bg-pasada-card px-[17px] py-[9px] shadow-sm backdrop-blur-xs">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-pasada-rust shadow-sm">
        <MapPin size={12} strokeWidth={2.5} className="text-white" />
      </div>
      <div className="flex items-center gap-1">
        <span className="font-manrope text-[11px] uppercase tracking-[0.6px] text-pasada-warm">
          NEXT:
        </span>
        <span className="font-manrope text-[14px] font-bold text-pasada-dark ml-1">
          {stopName}
        </span>
        <span className="font-manrope text-[12px] font-bold text-pasada-rust ml-1">
          {etaMin} min
        </span>
      </div>
    </div>
  );
}

function ActionButtons({ onUpdateOccupancy, onEndRoute }) {
  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={onUpdateOccupancy}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-pasada-border bg-[#e6e0d6] py-[17px] shadow-sm"
      >
        <UserPlus size={18} strokeWidth={2} className="text-pasada-dark" />
        <span className="font-manrope text-[16px] font-bold text-pasada-dark">
          Update Occupancy
        </span>
      </button>

      <button
        onClick={onEndRoute}
        className="relative flex w-full items-center justify-center gap-2 rounded-xl bg-pasada-rust py-[16px] shadow-md"
      >
        <Flag size={16} strokeWidth={2} className="text-white" />
        <span className="font-manrope text-[16px] font-bold text-white">End Route</span>
      </button>
    </div>
  );
}

/**
 * Props:
 *   routeLabel      – string e.g. "Lumban → Santa Cruz"
 *   occupancy       – number (passengers on board)
 *   capacity        – number
 *   speed           – number (km/h)
 *   nextStop        – { name: string, etaMin: number }
 *   driverPosition  – { lat: number, lng: number } | null
 *   onMenuOpen      – () => void
 *   onChatOpen      – () => void
 *   onUpdateOccupancy – () => void
 *   onEndRoute      – () => void
 */
export default function ActiveTripMap({
  routeLabel = "Route",
  occupancy = 0,
  capacity = 18,
  speed = 0,
  nextStop = null,
  driverPosition = null,
  onMenuOpen = () => {},
  onChatOpen = () => {},
  onUpdateOccupancy = () => {},
  onEndRoute = () => {},
}) {
  const mapCenter = driverPosition ?? { lat: 14.5995, lng: 121.5 };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-pasada-cream font-manrope">

      {/* Map layer */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={15}
          zoomControl={false}
          style={{ width: "100%", height: "100%" }}
          className="[filter:sepia(0.3)_saturate(0.8)_brightness(1.05)]"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          {driverPosition && (
            <Marker position={[driverPosition.lat, driverPosition.lng]} icon={driverIcon} />
          )}
          {driverPosition && <RecenterMap position={driverPosition} />}
        </MapContainer>
      </div>

      {/* Top gradient */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40"
        style={{ background: "linear-gradient(180deg, rgba(250,245,238,0.9) 0%, rgba(250,245,238,0) 100%)" }}
      />

      {/* Bottom gradient */}
      <div
        className="pointer-events-none absolute bottom-0 inset-x-0 z-10 h-64"
        style={{ background: "linear-gradient(0deg, rgb(250,245,238) 0%, rgba(250,245,238,0) 100%)" }}
      />

      {/* Header */}
      <TripHeader routeLabel={routeLabel} onMenuOpen={onMenuOpen} onChatOpen={onChatOpen} />

      {/* HUD + next stop — floats over map */}
      <div className="absolute left-4 right-4 top-[76px] z-[999] flex flex-col">
        <div className="flex gap-3">
          <HUDCard
            icon={Users}
            iconBg="rgba(212,112,112,0.3)"
            label="Occupancy"
            primary={String(occupancy)}
            secondary={`/${capacity}`}
          />
          <HUDCard
            icon={Gauge}
            iconBg="rgba(234,226,218,0.5)"
            label="Speed"
            primary={String(speed)}
            secondary=" km/h"
          />
        </div>

        {nextStop && (
          <NextStopPill stopName={nextStop.name} etaMin={nextStop.etaMin} />
        )}
      </div>

      {/* Bottom action buttons */}
      <div className="absolute bottom-0 inset-x-0 z-[999] px-4 pb-8">
        <ActionButtons onUpdateOccupancy={onUpdateOccupancy} onEndRoute={onEndRoute} />
      </div>
    </div>
  );
}
