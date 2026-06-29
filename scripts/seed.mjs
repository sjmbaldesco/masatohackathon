/**
 * Pasada demo seed script
 * Usage: node scripts/seed.mjs
 *
 * Requires backend/.env with FIREBASE_SERVICE_ACCOUNT_PATH set.
 * Seeds: routes/R01, stops, 2 waiting passengers
 */
import admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../backend/.env") });

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error("FIREBASE_SERVICE_ACCOUNT_PATH not set in backend/.env");
  process.exit(1);
}

const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, "../backend", serviceAccountPath), "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

// ── Polyline (15 waypoints: Lumban → Sta. Cruz) ─────────────────
const POLYLINE = [
  [14.2976, 121.4750],
  [14.2965, 121.4720],
  [14.2950, 121.4685],
  [14.2935, 121.4645],
  [14.2915, 121.4595],
  [14.2900, 121.4545],
  [14.2885, 121.4490],
  [14.2875, 121.4445],
  [14.2860, 121.4395],
  [14.2850, 121.4350],
  [14.2845, 121.4295],
  [14.2835, 121.4250],
  [14.2825, 121.4215],
  [14.2820, 121.4183],
];

// IDs match the backend's format: {route_id}_{stop_name}
const STOPS = [
  { id: "R01_Lumban",     name: "Lumban",     lat: 14.2976, lng: 121.4750, count: 0 },
  { id: "R01_Town Plaza", name: "Town Plaza", lat: 14.2965, lng: 121.4720, count: 2 },
  { id: "R01_Pagsawitan", name: "Pagsawitan", lat: 14.2875, lng: 121.4445, count: 1 },
  { id: "R01_Sta. Cruz",  name: "Sta. Cruz",  lat: 14.2820, lng: 121.4183, count: 0 },
];

async function seed() {
  const batch = db.batch();

  // ── Route ────────────────────────────────────────────────────────
  batch.set(db.collection("routes").doc("R01"), {
    route_id: "R01",
    name: "Lumban → Sta. Cruz",
    origin: "Lumban",
    destination: "Sta. Cruz",
    fare_base: 13,
    stops: STOPS.map((s) => s.name),
    polyline: POLYLINE,
    active_drivers: 0,
    total_waiting: 0,
  });

  // ── Stops ────────────────────────────────────────────────────────
  for (const stop of STOPS) {
    batch.set(db.collection("stops").doc(stop.id), {
      stop_id: stop.id,
      route: "R01",
      name: stop.name,
      stop: stop.name, // matches backend's field name
      lat: stop.lat,
      lng: stop.lng,
      count: stop.count,
    });
  }

  // ── Demo waiting passengers ──────────────────────────────────────
  batch.set(db.collection("passengers").doc("demo-pax-01"), {
    uid: "demo-pax-01",
    route: "R01",
    stop: "Town Plaza",
    lat: 14.2965,
    lng: 121.4720,
    status: "waiting",
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  batch.set(db.collection("passengers").doc("demo-pax-02"), {
    uid: "demo-pax-02",
    route: "R01",
    stop: "Town Plaza",
    lat: 14.2963,
    lng: 121.4718,
    status: "waiting",
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();
  console.log("✅ Seed complete:");
  console.log("  routes/R01 — Lumban → Sta. Cruz (14-point polyline)");
  console.log("  stops: lumban, town-plaza (+2), pagsawitan (+1), sta-cruz");
  console.log("  passengers: demo-pax-01, demo-pax-02 waiting at Town Plaza");
  admin.app().delete();
}

seed().catch((e) => { console.error(e); process.exit(1); });
