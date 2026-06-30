# Pasada — Bug-Fix Brief for Claude Code

**Purpose:** A prioritized, diagnostic checklist for fixing the live bugs in the Pasada app before the SparkFest demo (deadline **July 2, 2026**).

## How to use this brief

1. Run Claude Code **inside the real repo** (`github.com/sjmbaldesco/masatohackathon`, branch `main`) — not the stale scaffold copy in the Cowork folder.
2. **Read `CLAUDE.md` and `docs/TECHNICAL_SPEC.md` first.** Honor every constraint there: don't swap the stack, don't rescaffold, keep Gemini/Departure Confidence, and **protect the golden thread above all else**.
3. **File paths below are best-guess.** The repo evolved from an earlier scaffold (Google auth → email/password, `/coop` → admin, added `sim.js`/`demo_service.py`). Each item gives a **symbol to `grep` for** — confirm the real location before editing.
4. **Work strictly top-down: P0 → P1 → P2.** P0 = demo blockers, P1 = correctness, P2 = polish. **Do not touch P2 until the golden thread passes end-to-end** (checklist at the bottom).
5. Make **minimal, targeted diffs.** Add `console.log`/`console.error` while diagnosing; remove them before finishing. Don't refactor unrelated code.
6. After each fix, run its **Verify** step. Re-run the golden-thread checklist after P0 and again after P1.

> **Golden thread (must work):** Passenger taps "I'm waiting" → demand +1 → Admin Live Ops + Driver see it → Driver sets occupancy 100% → Passenger seats flip to **Full**, Admin unit turns **red** → Departure Confidence recalculates → Driver taps **Start Trip** → jeep animates, Passenger ETA counts down. Any fix that risks this thread is wrong.

---

# P0 — Demo blockers (fix first)

## P0-1 · Page disappears ~1 second after login

**Symptom:** After signing in, the destination page (Driver/Passenger/Admin) renders, then ~1s later it vanishes — either goes blank/white or bounces back to the login screen.

**Diagnose first — this one decision splits the whole fix.** Open DevTools and reproduce:

- **Does the URL change** (e.g. back to `/login` or to the wrong role's route)? → It's a **redirect / auth-role race** (causes A–C below).
- **Does the URL stay but the screen go white/blank**, with a red error in the Console? → A **child component is throwing** when async data/maps arrive (cause D). The "~1 second" is the first Firestore snapshot or the Maps library finishing loading.

**Before anything else, add an Error Boundary** so a throw shows a message instead of a silent white screen — this turns the mystery into a one-line diagnosis:

```jsx
// frontend/src/components/shared/ErrorBoundary.jsx
import { Component } from "react";
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("UI crash:", error, info); }
  render() {
    if (this.state.error)
      return <div className="p-4 text-sm text-red-600">Crashed: {String(this.state.error?.message)}</div>;
    return this.props.children;
  }
}
```

Wrap each routed page (or the `<Routes>` block) in `App.jsx` with `<ErrorBoundary>`. Then read the Console: it names the throwing file and line.

**Likely causes, ranked:**

- **(A) Role resolves after `loading` flips to false.** `grep` for `onAuthStateChanged` and `loading` in `context/AuthContext.jsx`. Role comes from an async `getDoc(users/{uid})`; if `setLoading(false)` runs before the role is fetched, `ProtectedRoute` sees a logged-in user with `role === null`, fails the role check, and redirects away. **Fix:** keep `loading === true` until **both** `user` **and** `role` are resolved (`await` the role lookup *before* `setLoading(false)`).
- **(B) Demo account has no matching `users/{uid}` role doc.** `grep` the seed script (`create_demo_accounts.py` / `start_demo.py`) for how it writes roles. If it keys the role doc by email or a hardcoded id instead of the **Firebase Auth `uid`**, then `getDoc(doc(db,"users", uid))` returns nothing → role is null or defaults. **Fix:** seed `users/{userCredential.user.uid}` with the correct `role` for each demo account; confirm the doc IDs match the actual UIDs.
- **(C) "First sign-in defaults to passenger" logic.** `grep` for `role: "passenger"` or `setDoc` inside the auth listener. The scaffold silently created a passenger doc for any unknown user — that **downgrades a Driver/Admin to passenger and bounces them off their page.** **Fix:** remove/replace that default for the fixed demo accounts; if a role is genuinely missing, fail loudly (show an error) rather than guessing.
- **(D) A child throws when data/maps arrive (no Error Boundary).** Most common offenders: reading `data[0].something` while the Firestore array is still `[]`; `<HeatmapLayer>` mounting before the Maps `visualization` library is loaded (see **P0-2**); reading `route.polyline` before it's fetched. **Fix:** guard every data-dependent render against empty/loading state; gate map children on `isLoaded`.

**Also harden `ProtectedRoute`** (`grep ProtectedRoute`): keep the loading gate, and normalize role strings so casing/synonyms don't cause a false redirect:

```jsx
if (loading) return <LoadingSpinner />;
if (!user) return <Navigate to="/login" replace />;
const norm = (r) => (r ?? "").toString().trim().toLowerCase();
if (roles.length && !roles.map(norm).includes(norm(role)))
  return <Navigate to={roleHome(role)} replace />;
```

(Watch for an `admin` vs `dispatcher` mismatch between the route's allowed roles and the seeded role string — a classic silent redirect.)

**Verify:** Log in as each of the three demo accounts (DRV-01482 / passenger@pasada.app / admin@pasada.app). Each lands on its own portal and **stays** for 10+ seconds. No Console errors. Refreshing the page keeps you on the same portal.

---

## P0-2 · Map and heatmap crash or render gray

**Symptom:** Map is blank/gray, or the page blanks right after a map-heavy view loads (often the same root cause as P0-1 cause D).

**Likely causes, ranked:**

- **(A) `HeatmapLayer` without the `visualization` library.** `grep` for `HeatmapLayer` and `libraries`. `HeatmapLayer` requires the Maps `visualization` library; if it isn't loaded, `google.maps.visualization` is undefined and the component **throws**, blanking the page. **Fix:** load it once, with a module-scoped array (a fresh array each render triggers reload warnings/perf issues):

  ```jsx
  // module scope — NOT inside the component
  const LIBRARIES = ["visualization"];
  const { isLoaded } = useJsApiLoader({ id: "gmaps", googleMapsApiKey: KEY, libraries: LIBRARIES });
  // never render <HeatmapLayer> (or any map child) until isLoaded === true
  ```

- **(B) Maps loaded more than once.** If different components each call `LoadScript`/`useJsApiLoader` with different `libraries`, you get *"You have included the Google Maps JavaScript API multiple times"* and the map fails. **Fix:** exactly **one** loader for the whole app (a shared hook/provider); every map view consumes its `isLoaded`.
- **(C) Heatmap data in the wrong shape.** `HeatmapLayer` wants `google.maps.LatLng` objects, or `{ location: new google.maps.LatLng(lat, lng), weight }` — plain `{ lat, lng }` silently renders nothing. `grep` the heatmap's `data`/`points` prop and convert.
- **(D) Gray map after a visibility toggle.** The Admin Live-Ops map is kept mounted and toggled via CSS visibility (per the overview). Google Maps paints **gray** if it was `display:none`/zero-size when it initialized or when re-shown. **Fix:** on re-show, call `google.maps.event.trigger(map, "resize")` and re-`panTo` the center. Prefer toggling with `visibility`/opacity over `display:none`, and ensure the container always has a non-zero height.
- **(E) Gray map, all views.** Usually the map container has no height (needs explicit `h-…`/`100%` with a sized parent), or an API-key problem (referrer restriction, billing disabled, missing `VITE_GOOGLE_MAPS_API_KEY`). Check the Console for `Google Maps JavaScript API error:` and fix the key/referrer.

**Verify:** All three portals show a real (non-gray) map. The demand heatmap renders when passengers are waiting. Switching Admin tabs away from Live Ops and back keeps the map painted (not gray). No `google.maps` errors in Console.

---

## P0-3 · Realtime state doesn't sync across the three views

**Symptom:** Passenger taps "I'm waiting" but Admin/Driver demand doesn't move; Driver changes occupancy but Passenger seats/Admin color don't update; a view is stuck "loading" or empty.

**Likely causes, ranked:**

- **(A) Firestore rules reject a read/write.** `grep firestore.rules`. If a view writes/reads a collection the rules don't cover (e.g. a `waiting`/`demand` collection the Passenger writes, or a `stops` aggregate the Driver reads), `onSnapshot` fires its **error** callback and that view goes silent. **Fix:** confirm every collection used by the live UI has matching `allow read`/`allow write` for an authenticated user; per CLAUDE.md you may open rules to authenticated users for the demo. Watch the Console for `Missing or insufficient permissions`.
- **(B) Missing composite index.** Filtered/ordered queries (`where` + `orderBy`, or multiple `where`) need an index. A missing one makes `onSnapshot` error with a link to create it. **Fix:** add it to `firestore.indexes.json` and deploy, or simplify the query.
- **(C) Field-name drift between writer and listener.** Writes go through FastAPI (Admin SDK); reads come via Firestore listeners. If the backend writes `occupancy` but the UI reads `occupancyCount` (or `position` vs `location`, `routeId` vs `route`), the UI never updates even though data is flowing. `grep` both sides for the field names and make them match the data model in the spec. (Authoritative per CLAUDE.md: `occupancyCount`; `occupancyPercent = round(count/capacity*100)`.)
- **(D) Listener re-subscribing or never firing.** `grep useCollection`. Ensure the effect's deps are stable (the scaffold uses `JSON.stringify(filters)`); a fresh filter object each render causes infinite re-subscribe. Confirm the unsubscribe is returned from `useEffect`.
- **(E) Writing local state instead of Firestore.** Per CLAUDE.md, components must not hold authoritative jeep/demand state locally. If "I'm waiting" or "Update Occupancy" only sets React state, other devices never see it. **Fix:** route the write through `services/api.js` → FastAPI, or a permitted owner-doc write.

**Verify:** With two browsers side by side, "I'm waiting" in Passenger increments Admin **Passenger Demand** and the Driver demand indicator within ~1s. Driver occupancy 100% flips Passenger to **Full** and the Admin unit to **red**, live, no refresh.

---

# P1 — Correctness (fix after the golden thread is solid)

## P1-1 · Occupancy and "Full" logic

`grep` for `occupancyCount`, `occupancyPercent`, `capacity`. Enforce the spec: `occupancyPercent = round(occupancyCount / capacity * 100)`; quick buttons (25/50/70/100) set `occupancyCount = round(capacity * level)`; the −/＋ stepper edits the exact count. Passenger **seats available = capacity − occupancyCount**, and **0 ⇒ show "Full"** (not "0/18"). Verify the quick buttons, the stepper, and the Full state all agree across Driver/Passenger/Admin.

## P1-2 · ETA and progress bar

`grep` for `eta`, `progress`, `Distance Matrix`/`Directions`. Progress bar = `1 − remainingETA / etaAtStart`; **store `etaAtStart`** when the trip/leg begins or the bar will jump around. Compute ETA from the jeep's **live synced position** to the passenger's stop — not from a separately cached route, or ETA and the marker will disagree. Handle the Distance Matrix returning `ZERO_RESULTS`/quota errors gracefully (fallback estimate, no crash).

## P1-3 · Simulation ownership (frontend vs backend double-writing)

Per the overview, the **Driver's own jeep is driven by frontend `sim.js`** while the **3 demo jeeps are backend-driven** (`demo_service.py`). Risk: both writing the same jeep doc → teleporting/jitter. `grep` for `sim`, the tick interval (`500`), and where each writes position. **Ensure one writer per unit:** the logged-in driver's unit is written only by the frontend; demo units only by the backend; never both. Confirm both run the same speed/tick (50 km/h / 500ms) so motion looks consistent. On End Trip / unmount, clear the interval (no leaked tickers).

## P1-4 · Auth edge cases

- **Logout doesn't clear role.** `grep logout`/`signOut`. Ensure `user` and `role` reset to null so the next login starts clean.
- **Create-vs-sign-in.** If the login path calls `createUserWithEmailAndPassword` for existing accounts it errors (`email-already-in-use`). Use `signInWithEmailAndPassword` for the demo accounts; seed them once via the script.
- **Missing env vars.** Confirm `VITE_FIREBASE_*`, `VITE_GOOGLE_MAPS_API_KEY`, the ORS key, and the Gemini key are present in `frontend/.env` / `backend/.env`. A missing key fails silently (blank map, no AI score). Don't commit them.
- **Departure Confidence Score (Gemini).** `grep` `confidence`/`gemini`. Ensure it recomputes when demand changes and **fails soft** — if the Gemini call errors/times out, show a sane fallback number, never a crash or infinite spinner (this sits on the golden thread).

---

# P2 — Polish (only after P0+P1 and the golden thread pass)

These are the "known limitations." Each notes the **lowest-risk** option for a demo — weigh against remaining time; protecting the thread beats adding surface area.

## P2-1 · Voice search (mic icon)
Currently a non-functional placeholder. **Lowest-risk:** wire the browser `webkitSpeechRecognition`/`SpeechRecognition` API to dictate into the existing "Where to?" field (a few lines, no backend). **If time-poor:** disable the icon with a tooltip so it doesn't read as broken. Don't build a custom audio pipeline.

## P2-2 · Fare calculation
Not implemented. **Recommended:** show a **computed fare estimate** (distance × per-km rate from the route data) as display-only — cheap, demo-friendly, on-brand. **Do not** build real payment; it's off the golden thread and high-risk. If payment can't be shown convincingly, hide the control rather than fake a transaction.

## P2-3 · Routes R02 / R03 (no polyline or live jeeps)
**Recommended for the demo:** mark R02/R03 as "Coming soon"/disabled in the UI so they don't look broken, and keep all live action on **R01 (Lumban ↔ Sta. Cruz)** per CLAUDE.md's one-route decision. **Only if time allows:** seed minimal ORS polylines + a stub jeep each. Don't let an empty R02/R03 throw when opened.

## P2-4 · Analytics page (static mock data)
**Lowest-risk:** clearly label the panels as "Sample" so it's honest on stage. **Better if time allows:** wire one or two **real aggregates** from Firestore (e.g. live waiting-passenger count, average occupancy) so at least part of Analytics is live; leave the rest labeled sample. Keep the Gemini **AI Insights** component working (it's a judging hook).

---

# Final verification — run before calling it done

Record on three devices/tabs (Driver phone, Passenger phone, Admin laptop) against the deployed URL:

1. Each demo account logs in and **stays** on its portal (no disappear/redirect, survives refresh).
2. All three maps render (not gray); heatmap shows waiting demand.
3. Passenger **"I'm waiting"** → demand +1 on Admin Demand and Driver indicator (live).
4. Driver **Update Occupancy → 100%** → Passenger flips to **Full**, Admin unit turns **red** (live).
5. **Departure Confidence** recalculates from new demand (with a soft fallback if Gemini errors).
6. Driver **Start Trip** → jeep animates along the R01 polyline; Passenger **ETA counts down**; Admin tab-switch keeps the map painted.
7. No uncaught errors in any Console.

If all seven pass, the demo is safe. Stop there unless time remains for P2.
