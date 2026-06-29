import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // "passenger" | "driver" | "admin"
  const [loading, setLoading] = useState(true);

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
    try {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        const cred = await signInAnonymously(auth);
        currentUser = cred.user;
      }
      await setDoc(doc(db, "users", currentUser.uid), {
        uid: currentUser.uid,
        role: selectedRole,
        createdAt: new Date().toISOString(),
      });
      setRole(selectedRole);
    } catch (err) {
      console.error("selectRole error:", err);
      throw err;
    }
  }

  async function logout() {
    await signOut(auth);
    setRole(null);
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, selectRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
