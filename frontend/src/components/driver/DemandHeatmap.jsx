import { useEffect, useRef } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_CENTER, toHeatmapData } from "../../services/maps";

export default function DemandHeatmap({ demandPoints = [], driverPosition }) {
  const center = driverPosition ?? DEFAULT_CENTER;
  const mapRef = useRef(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || demandPoints.length === 0) return;

    import("leaflet.heat").then(() => {
      const heat = L.heatLayer(toHeatmapData(demandPoints), {
        radius: 35,
        blur: 20,
        maxZoom: 17,
      }).addTo(map);
      return () => map.removeLayer(heat);
    });
  }, [demandPoints]);

  return (
    <MapContainer
      center={center}
      zoom={14}
      style={{ width: "100%", height: "100%" }}
      ref={mapRef}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />
    </MapContainer>
  );
}
