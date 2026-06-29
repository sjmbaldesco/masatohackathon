import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import Navbar from "../components/shared/Navbar";
import RouteSelector from "../components/passenger/RouteSelector";
import WaitingButton from "../components/passenger/WaitingButton";
import ETACard from "../components/passenger/ETACard";
import { useCollection } from "../hooks/useFirestore";
import { useGPS } from "../hooks/useGPS";
import { broadcastWaiting, cancelWaiting } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { DEFAULT_CENTER } from "../services/maps";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function PassengerPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState({ routeId: "", stop: "" });
  const [isWaiting, setIsWaiting] = useState(false);
  const [nearestJeep, setNearestJeep] = useState(null);
  const { position } = useGPS();

  const { data: routes } = useCollection("routes");

  const { data: drivers } = useCollection("drivers", [
    ["route", "==", selected.routeId || "__none__"],
    ["status", "==", "active"],
  ]);

  // TODO: compute nearestJeep from drivers + position using ORS ETA

  async function handleToggleWaiting() {
    if (isWaiting) {
      await cancelWaiting(user.uid);
      setIsWaiting(false);
    } else {
      await broadcastWaiting({
        stop: selected.stop,
        route: selected.routeId,
        lat: position?.lat,
        lng: position?.lng,
      });
      setIsWaiting(true);
    }
  }

  const canWait = !!selected.routeId && !!selected.stop;

  return (
    <div className="flex h-full flex-col">
      <Navbar title="Passenger" />

      <div className="relative flex-1">
        <MapContainer
          center={position ?? DEFAULT_CENTER}
          zoom={15}
          style={{ width: "100%", height: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />
          {position && (
            <Marker position={position}>
              <Popup>You are here</Popup>
            </Marker>
          )}
          {/* TODO: HeatmapLayer for demand around selected stop */}
          {/* TODO: Markers for active jeeps on route */}
        </MapContainer>

        <div className="absolute bottom-0 left-0 right-0 space-y-3 rounded-t-3xl bg-gray-50 p-4 shadow-xl">
          <ETACard jeep={nearestJeep} />
          <RouteSelector routes={routes} selected={selected} onChange={setSelected} />
          <WaitingButton isWaiting={isWaiting} disabled={!canWait} onToggle={handleToggleWaiting} />
        </div>
      </div>
    </div>
  );
}
