import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { completeRedirectSignIn, watchUser } from "../lib/auth";

export const useAuthUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    completeRedirectSignIn()
      .catch(() => {})
      .then(() => {
        unsub = watchUser((nextUser) => {
          setUser(nextUser);
          setLoading(false);
        });
      });
    return () => unsub?.();
  }, []);

  return { user, loading };
};
