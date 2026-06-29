import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // "passenger" | "driver" | "admin"
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) setRole(userDoc.data().role ?? null);
        } catch (err) {
          console.error("AuthContext Firestore error:", err);
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

  async function selectRole(selectedRole) {
    setAuthError(null);
    try {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        const cred = await signInAnonymously(auth);
        currentUser = cred.user;
      }

      // Set state immediately so ProtectedRoute doesn't bounce back on navigate
      setUser(currentUser);
      setRole(selectedRole);

      // Fire-and-forget Firestore write — don't block navigation on it
      setDoc(doc(db, "users", currentUser.uid), {
        uid: currentUser.uid,
        role: selectedRole,
        createdAt: new Date().toISOString(),
      }).catch((err) => console.warn("selectRole setDoc:", err));
    } catch (err) {
      const msg = err.code === "auth/operation-not-allowed"
        ? "Anonymous sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in methods."
        : err.message;
      setAuthError(msg);
      throw err;
    }
  }

  async function logout() {
    await signOut(auth);
    setRole(null);
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, authError, selectRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
