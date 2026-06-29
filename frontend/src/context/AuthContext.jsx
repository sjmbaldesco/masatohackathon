import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../services/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // "passenger" | "driver" | "dispatcher" | "admin"
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data().role);
          } else {
            await setDoc(doc(db, "users", firebaseUser.uid), {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              role: "passenger",
              createdAt: new Date().toISOString(),
            });
            setRole("passenger");
          }
          setUser(firebaseUser);
        } else {
          setUser(null);
          setRole(null);
        }
      } catch (err) {
        // Firestore unavailable — still sign the user in with a default role
        // so they aren't stuck on the login page
        console.error("AuthContext Firestore error:", err);
        if (firebaseUser) {
          setUser(firebaseUser);
          setRole("passenger");
          setAuthError(`Profile load failed: ${err.message}`);
        }
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = () => {
    setAuthError(null);
    signInWithPopup(auth, googleProvider).catch((err) => setAuthError(err.message));
  };
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, role, loading, authError, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
