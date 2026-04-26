import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { completeRedirectSignIn, watchUser } from "../lib/auth";

export const useAuthUser = () => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(auth.currentUser === null);

  useEffect(() => {
    // Register auth listener immediately — no need to wait for redirect resolution
    const unsub = watchUser((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    // Handle redirect sign-in in parallel without blocking the listener
    completeRedirectSignIn().catch((error) => {
      console.error("[auth] completeRedirectSignIn fallo:", error);
    });

    return () => unsub();
  }, []);

  return { user, loading };
};
