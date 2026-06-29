import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../services/firebase";

const AuthContext = createContext(null);

const ROLE_ROUTES = {
  passenger: "/passenger",
  driver: "/driver",
  admin: "/admin",
};

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [role,      setRole]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (snap.exists()) setRole(snap.data().role ?? null);
        } catch (err) {
          console.error("AuthContext Firestore read error:", err);
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // ── Internal helper ────────────────────────────────────────────────────────
  async function _persistRole(firebaseUser, selectedRole, extra = {}) {
    setUser(firebaseUser);
    setRole(selectedRole);
    setDoc(doc(db, "users", firebaseUser.uid), {
      uid: firebaseUser.uid,
      role: selectedRole,
      createdAt: new Date().toISOString(),
      ...extra,
    }, { merge: true }).catch((e) => console.warn("persistRole setDoc:", e));
  }

  // ── Email / Password login (Passenger & Admin) ────────────────────────────
  async function signInWithEmail(email, password, selectedRole) {
    setAuthError(null);
    try {
      let cred;
      try {
        cred = await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
          cred = await createUserWithEmailAndPassword(auth, email, password);
        } else {
          throw err;
        }
      }
      await _persistRole(cred.user, selectedRole);
    } catch (err) {
      const msg = _friendlyError(err.code);
      setAuthError(msg);
      throw err;
    }
  }

  // ── Google login (Passenger & Admin) ──────────────────────────────────────
  async function signInWithGoogle(selectedRole) {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await _persistRole(cred.user, selectedRole, {
        displayName: cred.user.displayName,
        email: cred.user.email,
      });
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user") return;
      const msg = _friendlyError(err.code);
      setAuthError(msg);
      throw err;
    }
  }

  // ── Driver ID + PIN login ─────────────────────────────────────────────────
  async function signInAsDriver(driverId, pin) {
    setAuthError(null);
    if (!driverId.match(/^DRV-\d{4,}$/i)) {
      const msg = "Driver ID must be in the format DRV-XXXX (e.g. DRV-01482).";
      setAuthError(msg);
      throw new Error(msg);
    }
    if (pin.length < 4) {
      const msg = "PIN must be at least 4 digits.";
      setAuthError(msg);
      throw new Error(msg);
    }
    try {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        const cred = await signInAnonymously(auth);
        currentUser = cred.user;
      }
      await _persistRole(currentUser, "driver", {
        driver_id: driverId.toUpperCase(),
      });
    } catch (err) {
      const msg = _friendlyError(err.code) ?? err.message;
      setAuthError(msg);
      throw err;
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  async function logout() {
    await signOut(auth);
    setRole(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{
      user, role, loading, authError, setAuthError,
      signInWithEmail, signInWithGoogle, signInAsDriver, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

function _friendlyError(code) {
  switch (code) {
    case "auth/operation-not-allowed":
      return "This sign-in method is disabled. Enable it in Firebase Console → Authentication.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return code ? `Sign-in error: ${code}` : null;
  }
}
