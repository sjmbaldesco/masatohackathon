import { useEffect, useRef, useState } from "react";

/**
 * Continuously watches the device's GPS position.
 * Calls onPositionUpdate({ lat, lng }) whenever position changes.
 *
 * @param {function} onPositionUpdate
 * @param {number} interval - ms between GPS pushes (default 7500ms)
 */
export function useGPS(onPositionUpdate, interval = 7500) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const watchId = useRef(null);
  const intervalRef = useRef(null);
  const latestPosition = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        latestPosition.current = coords;
        setPosition(coords);
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    // Throttled push to backend
    if (onPositionUpdate) {
      intervalRef.current = setInterval(() => {
        if (latestPosition.current) onPositionUpdate(latestPosition.current);
      }, interval);
    }

    return () => {
      navigator.geolocation.clearWatch(watchId.current);
      clearInterval(intervalRef.current);
    };
  }, [interval]);

  return { position, error };
}
