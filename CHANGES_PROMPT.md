# Pasada — Claude Code Prompt: 9 Changes

> Paste this whole file into Claude Code running **inside the real repo** (`github.com/sjmbaldesco/masatohackathon`, branch `main`).

You are implementing 9 changes to **Pasada**, a demand-first jeepney app (React 18 + Vite + Tailwind, `@react-google-maps/api`, Firebase Firestore listeners, FastAPI backend, Gemini `gemini-1.5-flash`, ORS polyline for route R01 Lumban ↔ Sta. Cruz).

**Rules of engagement:**

- **Read `CLAUDE.md` and `docs/TECHNICAL_SPEC.md` first.** Don't swap the stack, don't rescaffold, keep diffs minimal and targeted.
- **Protect the golden thread:** Passenger signals waiting → demand rises → Driver/Admin see it → Driver sets occupancy → Passenger seats flip to Full / Admin unit turns red → Departure Confidence recalculates → Driver Starts Trip → jeep animates, ETA counts down.
- **File paths below are best-guess** (the repo drifted from its scaffold). Each item names a **symbol to `grep`** — confirm the real file before editing.
- **All Gemini calls must soft-fail** (timeout/try-catch → deterministic fallback). They sit on the golden thread; a slow API must never blank or hang a page.
- **The Gemini API key stays server-side** (FastAPI only). The browser never calls Gemini directly.
- If `BUGFIX_BRIEF.md` exists in the repo, treat its fixes as prerequisites where cross-referenced.

**Recommended order** (golden thread first): **3 → 1 → 8 → 4 → 5 → 6 → 2 → 7 → 9.** Verify the golden thread end-to-end after #8, then again at the end.

---

## Change 1 · Driver simulation isn't moving (jeepney stays put)

**Goal:** On **Start Trip**, the driver's jeep animates smoothly along the R01 polyline at ~50 km/h; Passenger and Admin see the same movement live; ETA counts down.

**Where to look:** `grep -r "sim\|startTrip\|Start Trip\|requestAnimationFrame\|setInterval" frontend/src`; the driver marker in `pages/DriverPage.jsx`; `services/sim.js`; `routes/R01` polyline load.

**Diagnose, then fix — check these in order:**

- **Is the polyline loaded before the sim starts?** The 223-point path lives in `routes/R01`. If Start Trip fires before that doc arrives, the sim indexes into an empty array and produces no movement (or `NaN`). Gate Start Trip on `polyline.length > 0`.
- **Does the marker read the position the sim writes?** Confirm the sim updates the same source the marker renders from — either local React state *or* `drivers/{uid}.position` in Firestore — not a hardcoded first-stop coordinate. A common bug: the marker is pinned to `stops[0]` and never re-bound to the live position.
- **Is the ticker being torn down immediately?** React 18 StrictMode mounts→unmounts→remounts in dev, clearing the first interval. Store the interval/RAF id in a `useRef`, start it idempotently, and clear it only on End Trip/unmount — don't recreate it on every render (unstable deps).
- **Is the step math non-zero?** Advance a cumulative distance per tick (`metersPerTick = 50_000/3600 * tickSeconds`) and interpolate between polyline points by that distance. Don't step by raw lat/lng deltas — near the equator they're tiny and the jeep appears frozen.
- **Does the animation trigger a re-render?** If the sim mutates a plain variable, React never repaints. Drive it via `setState` (local) or a Firestore write the marker listens to.

**Implementation sketch:**

```js
// services/sim.js — advance a fraction along the polyline at a fixed speed
export function startSim({ polyline, tickMs = 500, kmh = 50, onPos }) {
  let dist = 0;                                  // meters travelled
  const total = cumulativeLengths(polyline);     // precompute segment lengths
  const id = setInterval(() => {
    dist += (kmh * 1000 / 3600) * (tickMs / 1000);
    const pos = pointAtDistance(polyline, total, dist); // {lat,lng, heading}
    if (!pos) return clearInterval(id);          // reached the end
    onPos(pos);                                  // -> setState AND/OR Firestore write
  }, tickMs);
  return () => clearInterval(id);                // caller stores in a ref, calls on End Trip
}
```

**Acceptance:** Tap Start Trip → marker visibly travels the R01 route; the map follows; Passenger/Admin mirror the motion live; ETA decreases; End Trip stops it; survives a page refresh; no console errors.

---

## Change 2 · "Recenter on me" button on the map

**Goal:** A floating button on the map that re-centers on the current location — the **jeep** on the Driver map, the **passenger's GPS** on the Passenger map.

**Where to look:** `grep -r "GoogleMap\|onLoad\|useGPS" frontend/src/pages`; reuse the map instance captured in `onLoad`.

**Implementation:** One reusable button, positioned over the map, that calls `map.panTo(target)`:

```jsx
import { LocateFixed } from "lucide-react";
function RecenterButton({ map, target }) {           // target = live jeep pos OR passenger GPS
  if (!map || !target) return null;
  return (
    <button onClick={() => { map.panTo(target); map.setZoom(16); }}
      className="absolute bottom-24 right-4 z-10 rounded-full bg-white p-3 shadow-lg active:scale-95"
      aria-label="Recenter on my location">
      <LocateFixed className="h-5 w-5 text-brand-dark" />
    </button>
  );
}
```

Mount it inside each map container (the container must be `relative`). Pass the driver's live position on DriverPage, the passenger GPS on PassengerPage.

**Acceptance:** Button shows on both maps; after panning away, tapping it re-centers on the live position; doesn't fight the Driver's auto-follow (it just re-snaps).

---

## Change 3 · Passenger button: "Signal" → "Waiting at {Place}" (two states)

**Goal:** The button starts as **"Signal"** (inactive = not waiting). Tapping it broadcasts the passenger's location to Firestore and the label becomes **"Waiting at {Place}"** (active = alerts Admin + Driver). Tapping again cancels back to "Signal".

**Where to look:** `grep -r "I'm waiting\|WaitingButton\|waiting" frontend/src`. This drives golden-thread step 1; the write must hit the **same** collection/fields the Admin Demand and Driver indicator listen to (if there's a field-name mismatch, see `BUGFIX_BRIEF.md` P0-3).

**Implementation:**

```jsx
const [waiting, setWaiting] = useState(false);
const place = nearestStop?.name ?? "your location";   // resolve from GPS/nearest stop
async function toggle() {
  if (!waiting) { await api.startWaiting({ uid, stopId, place, route: "R01" }); setWaiting(true); }
  else          { await api.cancelWaiting({ uid }); setWaiting(false); }
}
// className: waiting ? "bg-brand-red text-white" : "border border-white/30 text-white/80"
// label:     waiting ? `Waiting at ${place}` : "Signal"
```

- Inactive "Signal" state = muted/outline styling; active state = solid rust/red.
- On mount, reflect existing state (if a waiting doc already exists for this uid, start in the active state).
- Cancel removes the waiting doc so demand decrements everywhere.

**Acceptance:** Button starts as "Signal" (inactive). Tap → "Waiting at {Place}" (active), Admin Demand +1 and Driver indicator rises within ~1s. Tap again → back to "Signal", demand −1. State is correct after refresh.

---

## Change 4 · Density-based heatmap (smooth, not stacked red blobs)

**Goal:** Replace stacked opaque red overlays with a single heatmap whose color reflects **density**: sparse = cool/faint, dense = saturated red, smoothly graded.

**Where to look:** `grep -r "HeatmapLayer\|gradient\|weight" frontend/src`. Ensure the Maps `visualization` library is loaded (see `BUGFIX_BRIEF.md` P0-2) or `HeatmapLayer` throws.

**Implementation:** Use **one** `HeatmapLayer`. Aggregate waiting passengers per stop/area into **weighted** points, define a gradient, and set `maxIntensity` so a single waiting person isn't already full-red:

```jsx
const GRADIENT = [
  "rgba(0,0,0,0)",
  "rgba(46,134,222,0.5)",   // sparse — cool blue
  "rgba(16,185,129,0.7)",   // green
  "rgba(245,158,11,0.85)",  // amber
  "rgba(239,35,60,0.95)",   // rust
  "rgba(217,4,41,1)",       // dense — deep red
];
// aggregate live waiting docs by stop/area
const byArea = new Map();
waiting.forEach(w => {
  const key = w.stopId ?? `${w.lat.toFixed(4)},${w.lng.toFixed(4)}`;
  byArea.set(key, (byArea.get(key) ?? 0) + 1);
});
const points = [...byArea.entries()].map(([key, count]) => ({
  location: new google.maps.LatLng(resolveLat(key), resolveLng(key)),
  weight: count,                                   // density drives saturation
}));
// <HeatmapLayer data={points}
//   options={{ gradient: GRADIENT, radius: 40, opacity: 0.7, maxIntensity: 8, dissipating: true }} />
```

Tune `maxIntensity` to the realistic max per area and `radius` to map zoom. Recompute `points` from live Firestore demand.

**Acceptance:** One waiter = faint cool spot; a cluster = saturated red, smoothly graded; no harsh overlapping blobs; updates live as people signal/cancel.

---

## Change 5 · Person icons (not pins); passenger sees only themselves

**Goal:** Represent the passenger as a **standing-person** icon, not a map pin. On the Passenger map, show **only the logged-in passenger** — not other passengers (their demand is conveyed by the heatmap on Driver/Admin only).

**Where to look:** `grep -r "Marker\|icon\|pin\|User" frontend/src/pages/PassengerPage.jsx`.

**Implementation:** Render a Lucide-style person SVG to a data URL and use it as the marker icon:

```js
const svg = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"
     fill="none" stroke="#2B2D42" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
     <circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/>
   </svg>`);                                         // Lucide "person-standing"
const personIcon = {
  url: `data:image/svg+xml;charset=UTF-8,${svg}`,
  scaledSize: new google.maps.Size(36, 36),
  anchor: new google.maps.Point(18, 18),
};
// <Marker position={me} icon={personIcon} />
```

- Passenger map renders: **the passenger's own** person icon + jeepneys + the R01 route. **No other-passenger markers.**
- Confirm the Passenger view isn't iterating the `passengers`/`waiting` collection to drop a pin per person — remove that; only render `me`.

**Acceptance:** Passenger sees themselves as a standing-person icon and no other passenger markers; Driver/Admin still show aggregate demand via the heatmap.

---

## Change 6 · Delete stray anonymous test data cluttering the map

**Goal:** Remove leftover anonymous passenger/driver docs from earlier testing (off-route, not part of the demo) so the map is clean. Prevent future strays from rendering.

**Where to look:** Firestore `passengers`, `drivers`, `waiting` collections; the queries in the three map views.

**Implementation — do both:**

1. **One-time cleanup script** (backend Admin SDK), dry-run by default:

```python
# scripts/clean_test_data.py   (run plain = dry-run; pass --apply to delete)
import sys
APPLY = "--apply" in sys.argv
DEMO_DRIVERS = {"DRV-01482"}                 # extend with the 3 demo unit ids
DEMO_PASSENGERS = {"passenger@pasada.app"}
def is_demo(col, doc):
    if col == "drivers":   return doc.get("driverId") in DEMO_DRIVERS or doc.get("route") == "R01"
    if col == "passengers":return doc.get("email") in DEMO_PASSENGERS
    return doc.get("route") == "R01"          # waiting docs
for col in ("passengers", "drivers", "waiting"):
    for d in db.collection(col).stream():
        if not is_demo(col, d.to_dict()):
            print(("DELETE " if APPLY else "would delete "), col, d.id, d.to_dict().get("email") or d.to_dict().get("plate"))
            if APPLY: d.reference.delete()
```

Run it as a dry-run first, eyeball the list, then `--apply`.

2. **Defensive filtering:** make the live map queries filter to `route == "R01"` and the known demo units, so any stray that reappears never renders.

**Acceptance:** Map shows only demo participants (the R01 jeeps + the demo passenger). The script is idempotent and safe to re-run; live views ignore non-R01 docs.

---

## Change 7 · Make the Admin page fully functional + export Analytics to Excel

**Goal:** No dead buttons on the Admin pages; interactive controls do real work; **Analytics exports to a populated `.xlsx`**.

**Where to look:** `grep -r "onClick\|Export\|Analytics" frontend/src/components/cooperative frontend/src/pages` (Admin/Coop dashboard).

**Implementation:**

- **Wire the interactive controls:** tab navigation, table row → detail side panel (Driver Roster, Fleet), Passenger Demand live table, filters/search — bind them to live Firestore data instead of static mock. Prioritize **Live Operations, Passenger Demand, Analytics**. For genuinely out-of-scope actions (create/edit fleet, etc.), **disable** them with a tooltip rather than leaving a dead button.
- **Excel export (client-side, SheetJS):** build a workbook from the analytics + live aggregates and download it.

```js
import * as XLSX from "xlsx";
async function exportAnalytics(model) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.summary), "Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.drivers), "Drivers");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(model.demand),  "Demand");
  // Change 9 adds an "AI Insights" sheet here (text comes from the backend).
  XLSX.writeFile(wb, "pasada-analytics.xlsx");
}
```

**Acceptance:** Every visible Admin control either works or is clearly disabled; the three deep tabs show live data; "Export to Excel" downloads a multi-sheet `.xlsx` populated with real numbers.

---

## Change 8 · Accurate Gemini Departure Confidence Score

**Goal:** A confidence score that genuinely reflects conditions — it moves when demand/occupancy change, stays in 0–100, is explainable, and never crashes or hangs the Driver page.

**Where to look:** `grep -r "confidence\|gemini\|gemini-1.5-flash" backend/app`.

**Approach — ground the number, let Gemini explain it.** A pure LLM number is non-deterministic and reads as "inaccurate." Compute a deterministic base from real Firestore inputs, then ask Gemini only for a **bounded adjustment + reason**, validated:

```python
def base_confidence(occupancy, capacity, demand_ahead, mins_since_last):
    fill     = occupancy / max(capacity, 1)          # how full now (0..1)
    pressure = min(demand_ahead / max(capacity, 1), 1)  # waiting demand ahead (0..1)
    headway  = min(mins_since_last / 20, 1)          # time since last departure (0..1)
    return round(max(0, min(100, 100 * (0.5*pressure + 0.3*fill + 0.2*headway))))

# Gemini: low temperature, STRICT JSON, bounded. Validate + clamp on return.
PROMPT = '''Given these jeepney dispatch facts, return ONLY JSON:
{{"adjustment": <int -10..10>, "level": "low|medium|high", "reason": "<=20 words"}}
Facts: occupancy={occ}/{cap}, demand_ahead={dem}, mins_since_last={hw}, base_score={base}.'''

def confidence(inputs):
    base = base_confidence(**inputs)
    try:
        out = call_gemini(PROMPT.format(base=base, **inputs), timeout=4)
        adj = max(-10, min(10, int(out["adjustment"])))
        return {"score": max(0, min(100, base + adj)), "level": out["level"], "reason": out["reason"]}
    except Exception:
        return {"score": base, "level": level_from(base), "reason": "Estimated from current demand and occupancy."}
```

- Recompute when demand/occupancy change; debounce and cache so you're not calling Gemini on every tick.
- **Soft-fail to `base`** on any error/timeout — the Driver page must never blank or spin forever.

**Acceptance:** Raising demand or occupancy visibly changes the score; it stays 0–100 with a sensible reason; if Gemini is slow/down, the deterministic base shows instantly with no crash.

---

## Change 9 · Use Gemini to enhance the Excel export

**Goal:** The exported workbook includes an **AI "Insights" sheet** — a short executive summary, notable trends, and recommendations — grounded in the actual exported numbers. Raw data sheets stay deterministic.

**Where to look:** the export util from Change 7; add a FastAPI endpoint for insights (keeps the Gemini key server-side).

**Implementation:**

- **Backend** `GET/POST /api/analytics/insights`: takes the aggregate model, prompts Gemini for a concise, factual summary (feed it the real totals so it can't invent figures), returns plain text. Low temperature; **fallback to a templated summary** if Gemini fails so export always succeeds.
- **Frontend:** before `writeFile`, fetch insights and add them as a sheet:

```js
const text = await api.getAnalyticsInsights(model).catch(() => templateSummary(model));
const rows = text.split("\n").map(line => [line]);
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "AI Insights");
```

- Keep it to **one** narrative sheet to bound complexity; sanitize the text (strip stray markdown).

**Acceptance:** The `.xlsx` opens with an "AI Insights" sheet whose statements match the data sheets; if Gemini is unavailable, the export still completes with a templated summary.

---

## Final verification (run before done)

Across three tabs/devices (Driver / Passenger / Admin) on the deployed URL:

1. Passenger button reads **"Signal"**, tap → **"Waiting at {Place}"**; Admin Demand + Driver indicator rise live; tap again cancels.
2. Driver **Start Trip** → jeep animates along R01; map follows; Passenger ETA counts down; Recenter button re-snaps both maps.
3. Heatmap grades smoothly by density (no stacked red blobs); Passenger sees only their own person icon.
4. No stray/anonymous markers anywhere on the map.
5. Driver **Departure Confidence** changes with demand/occupancy, stays 0–100, and shows instantly even if Gemini is slow.
6. Admin: no dead buttons; **Export to Excel** downloads a multi-sheet `.xlsx` including a grounded **AI Insights** sheet.
7. No uncaught errors in any console.

Stop when all seven pass.
