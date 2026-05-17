import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { clearLegacyGuestDemo, isGuest, guestUser, pauseGuest } from "@/lib/guest";

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

    const syncTimezone = (u: User) => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz && (u.user_metadata as any)?.timezone !== tz) {
          supabase.auth.updateUser({ data: { timezone: tz } }).catch(() => {});
        }
      } catch {}
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        // Always clear local state and redirect — no exceptions.
        setSession(null);
        setUser(null);
        setGuest(false);
        try {
          // Belt-and-braces: nuke any cached supabase session keys.
          Object.keys(localStorage)
            .filter((k) => k.startsWith("sb-") || k.startsWith("supabase."))
            .forEach((k) => localStorage.removeItem(k));
        } catch {}
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
        return;
      }
      setSession(s);
      if (s?.user) {
        pauseGuest();
        setUser(s.user);
        setGuest(false);
        syncTimezone(s.user);
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
        pauseGuest();
        setUser(data.session.user);
        setGuest(false);
        syncTimezone(data.session.user);
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
