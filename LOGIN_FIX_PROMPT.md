# Pasada — Login Fix Prompt for Claude Code

**Paste this entire file into Claude Code running inside `github.com/sjmbaldesco/masatohackathon` (branch `main`).**

You are fixing three confirmed bugs that break the login flow in Pasada — a demand-first jeepney coordination app (React 18 + Vite + Tailwind, Firebase Auth + Firestore, FastAPI backend, Gemini AI, Google Maps). Deadline is **July 2, 2026 (SparkFest / GDG PUP)**.

**Before touching anything:**
- Read `CLAUDE.md` and `docs/TECHNICAL_SPEC.md`. Don't swap the stack, don't rescaffold, keep Gemini/Departure Confidence, protect the golden thread.
- Every fix below names a **symbol to `grep` for** — confirm the real file/line before editing.
- Make **minimal, targeted diffs**. No refactors outside the named scope.
- Fix in order: **Fix 1 → Fix 2 → Fix 3**. Verify each before moving on.

---

## Fix 1 — AuthContext `initialized` race (P0 blocker)

**Symptom:** After login, the role page appears for a split second then the user is bounced back to `/login` or `/`. Role is always `null` after a fresh sign-in.

**Root cause:** `grep -n "initialized" context/AuthContext.jsx`

The `onAuthStateChanged` callback sets `initialized = true` unconditionally — including when it fires with `firebaseUser = null` (the initial not-logged-in state). When the user then actually signs in and the callback fires again with a real user, `initialized` is already `true`, so `if (!initialized)` skips the `getDoc` role lookup. Role stays `null` forever.

**Trace:**
```
App loads → onAuthStateChanged fires: null → initialized = true ← POISON
User logs in → onAuthStateChanged fires: user → if (!initialized) = false → getDoc SKIPPED
role = null → ProtectedRoute redirects to /login
```

**Fix:** Replace the boolean `initialized` flag with a UID tracker. Find the block shown below and replace it in full:

```js
// FIND THIS PATTERN (the exact variable names may differ slightly):
useEffect(() => {
  let initialized = false;
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      if (!initialized) {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (snap.exists()) setRole(snap.data().role ?? null);
      }
      setUser(firebaseUser);
    } else { setUser(null); setRole(null); }
    initialized = true;
    setLoading(false);
  });
  return unsubscribe;
}, []);

// REPLACE WITH:
useEffect(() => {
  let lastUid = null;
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      if (firebaseUser.uid !== lastUid) {
        lastUid = firebaseUser.uid;
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (snap.exists()) setRole(snap.data().role ?? null);
      }
      setUser(firebaseUser);
    } else {
      setUser(null);
      setRole(null);
      lastUid = null;
    }
    setLoading(false);
  });
  return unsubscribe;
}, []);
```

**Why this is correct:**
- Null initial fire → `lastUid` stays null, sets user/role null, no Firestore read
- Real login → `uid !== null` → reads Firestore, sets role ✓
- Strict Mode echo (same UID) → `uid === lastUid` → skips re-read ✓
- Logout then re-login → `lastUid = null` resets → reads Firestore again ✓

**Verify:** Sign in as passenger, driver, and admin. Each should land on their respective portal (`/passenger`, `/driver`, `/admin`) and **stay** for 10+ seconds. Hard-refresh should keep you on the same portal. No redirect loop.

---

## Fix 2 — ErrorBoundary throw: `Map is not a constructor` (P0 blocker)

**Symptom:** After Fix 1 lets the user reach the role page, the page crashes ~1 second after mount and the ErrorBoundary shows a red "Something went wrong" screen. The console shows `TypeError: Map is not a constructor` (or similar).

**Root cause:** `grep -n "from.*lucide-react" frontend/src/pages/DriverPage.jsx frontend/src/pages/PassengerPage.jsx`

This bug was already fixed in `AdminDashboard.jsx` (commit 85d97b1) but not applied to the other two pages. Any file that does `import { ..., Map, ... } from "lucide-react"` and also calls `new Map()` (the native JS `Map` constructor — used for grouping demand spots, building lookup tables, etc.) will throw because the Lucide icon component shadows the global.

**Diagnostic step first — read the exact ErrorBoundary message:**
```
grep -n "getDerivedStateFromError\|componentDidCatch\|Crashed" frontend/src/components/shared/ErrorBoundary.jsx
```
The error message rendered there (e.g., `Crashed: Map is not a constructor`) confirms this is the issue. If it says something else entirely, read the console stack trace and adjust.

**Fix (assuming Map import collision):**

In every affected page file:
1. Find the lucide-react import line: `grep -n "Map" frontend/src/pages/DriverPage.jsx frontend/src/pages/PassengerPage.jsx`
2. Change `{ Map }` → `{ Map as MapIcon }` in the import
3. Update every JSX usage of `<Map` → `<MapIcon` in that file
4. Do **not** change any `new Map()` calls — those are the native constructor and are correct

Example:
```js
// BEFORE
import { Navigation, Map, Clock } from "lucide-react";
// ...
<Map className="h-5 w-5" />

// AFTER
import { Navigation, Map as MapIcon, Clock } from "lucide-react";
// ...
<MapIcon className="h-5 w-5" />
```

**If the ErrorBoundary message is NOT `Map is not a constructor`:** Paste the exact message here (or read it from the console) and fix the actual throw. Common alternatives:
- `Cannot read properties of undefined (reading 'setAt')` → a class-based Polyline/Circle component is still present; switch it to PolylineF/CircleF
- `google is not defined` → a component accessing `window.google` before `isLoaded === true`; gate on `isLoaded`
- `Cannot read properties of null (reading 'something')` → a component reading `data.field` while Firestore hasn't responded yet; add a null guard

**Verify:** All three portals load their maps without crashing. No ErrorBoundary red screen on login. No `TypeError` in the console.

---

## Fix 3 — CORS mismatch (breaks Departure Score + AI Insights in dev)

**Symptom:** Departure Score card never loads (spins or shows "Backend unavailable"). Excel export AI Insights sheet contains template fallback strings. Console shows a CORS error on `http://localhost:8000/...` requests.

**Root cause:** `grep -n "ALLOWED_ORIGINS" backend/.env backend/app/main.py`

The backend was configured for `:3000` but Vite moved to `:3001` (port conflict). CORS preflight rejects all API calls from the frontend.

**Fix — one line in `backend/.env`:**
```
# BEFORE
ALLOWED_ORIGINS=http://localhost:3000

# AFTER
ALLOWED_ORIGINS=http://localhost:3001
```

Then restart the backend (`uvicorn app.main:app --reload --port 8000`).

**If `ALLOWED_ORIGINS` is consumed as a comma-separated list in `main.py`**, verify the value is parsed correctly (no extra spaces). Also confirm `main.py` includes it in `CORSMiddleware`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),  # or however it's parsed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Verify:** Open DevTools → Network. Trigger a Departure Score fetch (load the Driver portal, wait for auto-fetch). The `OPTIONS` preflight to `:8000` should return `200`, not `403`. The score card should populate within a few seconds.

---

## Final verification — golden thread

After all three fixes, run this sequence on three tabs/devices:

1. **Admin** logs in → Live Ops shows R01 polyline and (eventually) demand circles. No console errors.
2. **Passenger** logs in → taps "Signal" at Lumban → button turns rust ("Waiting at Lumban") → demand circle appears on Admin and Driver views within ~1 second.
3. **Driver** logs in → sees demand circle → Departure Score auto-fetches and shows a real score (not spinner, not "Backend unavailable").
4. Driver taps **Update Occupancy → 100%** → Passenger shows **Full** (0/18), Admin unit turns red.
5. Driver taps **Start Trip** → jeep marker animates along route → Passenger ETA counts down.
6. Admin → Analytics → Export to Excel → workbook downloads with AI Insights sheet populated (not template strings).

If all six pass: **the demo is safe**. Stop here unless time allows P2 polish.
