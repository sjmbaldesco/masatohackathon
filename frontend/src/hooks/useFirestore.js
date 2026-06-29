import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../services/firebase";

/**
 * Subscribe to a Firestore collection with optional where clauses.
 * Returns live { data, loading, error }.
 *
 * @param {string} collectionPath
 * @param {Array<[field, op, value]>} filters - e.g. [["route", "==", "Cubao-Divisoria"]]
 */
export function useCollection(collectionPath, filters = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let q = collection(db, collectionPath);

    if (filters.length > 0) {
      const whereConstraints = filters.map(([field, op, value]) =>
        where(field, op, value)
      );
      q = query(q, ...whereConstraints);
    }

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Firestore error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return unsub;
  }, [collectionPath, JSON.stringify(filters)]);

  return { data, loading, error };
}
