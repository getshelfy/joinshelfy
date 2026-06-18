import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startGuest, isGuest } from "@/lib/guest";
import { Sprout } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isRecentSignout = () => {
      try {
        const ts = Number(sessionStorage.getItem("shelfy:signing-out") || 0);
        return ts && Date.now() - ts < 2000;
      } catch {
        return false;
      }
    };

    if (!isRecentSignout()) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session || isGuest()) navigate({ to: "/" });
      });
    } else {
      setTimeout(() => {
        try { sessionStorage.removeItem("shelfy:signing-out"); } catch {}
      }, 2100);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && !isRecentSignout()) {
        navigate({ to: "/" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      try { sessionStorage.removeItem("shelfy:signing-out"); } catch {}
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.user) {
          navigate({ to: "/" });
        } else {
          setError("Check your email to confirm your account before signing in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    startGuest();
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-6 pb-8 pt-6">
      <div className="w-full max-w-sm">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Sprout className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-4xl font-semibold">Shelfy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Stop wasting food. Save a bit of money. Eat what you've got.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            <Button type="submit" disabled={loading} className="h-11 w-full text-base">
              {loading ? "..." : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
            <button
              type="button"
              onClick={() => { setError(null); setMode(mode === "signin" ? "signup" : "signin"); }}
              className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </form>
        </div>

        <button
          type="button"
          onClick={handleGuest}
          className="mt-6 block w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Continue without signing in →
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Guest data stays on this device. Sign in any time to save it to your account.
        </p>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <a href="https://tryshelfy.com/terms" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="https://tryshelfy.com/privacy" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
