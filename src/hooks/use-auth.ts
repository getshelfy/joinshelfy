import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { clearLegacyGuestDemo, isGuest, guestUser } from "@/lib/guest";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [guest, setGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkGuest = () => {
      clearLegacyGuestDemo();
      const g = isGuest();
      setGuest(g);
      if (g) setUser(guestUser() as unknown as User);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setUser(s.user);
        setGuest(false);
      } else if (isGuest()) {
        setUser(guestUser() as unknown as User);
        setGuest(true);
      } else {
        setUser(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        setUser(data.session.user);
      } else {
        checkGuest();
      }
      setLoading(false);
    });

    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("shelfy:guest")) checkGuest();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { session, user, loading, isGuest: guest };
}
