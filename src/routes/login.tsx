import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
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
  const [oauthLoading, setOauthLoading] = useState(false);
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

  const handleOAuth = async (provider: "google" | "apple") => {
    setOauthLoading(true);
    setError(null);
    try { sessionStorage.removeItem("shelfy:signing-out"); } catch {}
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(result.error.message || "Sign-in failed. Please try again.");
        setOauthLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/" });
    } catch (err: any) {
      setError(err?.message || "Sign-in failed. Please try again.");
      setOauthLoading(false);
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
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuth("google")}
            disabled={oauthLoading}
            className="h-11 w-full text-base"
          >
            <GoogleIcon className="mr-2 h-4 w-4" />
            {oauthLoading ? "Opening…" : "Continue with Google"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuth("apple")}
            disabled={oauthLoading}
            className="h-11 w-full text-base"
          >
            <AppleIcon className="mr-2 h-4 w-4" />
            {oauthLoading ? "Opening…" : "Continue with Apple"}
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

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
            <Button type="submit" disabled={loading} className="h-11 w-full text-base">
              {loading ? "..." : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.51h3.227c1.886-1.737 2.986-4.296 2.986-7.351z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.227-2.51c-.895.6-2.04.955-3.391.955-2.605 0-4.81-1.76-5.596-4.122H3.07v2.59A9.997 9.997 0 0 0 12 22z"
        fill="#34A853"
      />
      <path
        d="M6.404 13.9A6.005 6.005 0 0 1 6.09 12c0-.66.114-1.3.314-1.9V7.51H3.07A9.997 9.997 0 0 0 2 12c0 1.614.386 3.14 1.07 4.49l3.334-2.59z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.977c1.468 0 2.786.504 3.823 1.495l2.866-2.866C16.96 2.99 14.696 2 12 2A9.997 9.997 0 0 0 3.07 7.51l3.334 2.59C7.19 7.738 9.395 5.977 12 5.977z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.42 2.23-1.18 3.05-.84.92-2.21 1.63-3.32 1.54-.14-1.1.42-2.27 1.16-3.05.83-.88 2.27-1.55 3.34-1.54zM20.5 17.36c-.55 1.27-.81 1.84-1.51 2.96-.98 1.55-2.36 3.49-4.07 3.5-1.52.01-1.91-.99-3.97-.98-2.06.01-2.49 1-4.01.99-1.71-.01-3.02-1.76-4-3.32C.45 16.18-.39 11.06 1.85 7.6c1.59-2.45 4.1-3.88 6.46-3.88 2.4 0 3.91 1.32 5.9 1.32 1.93 0 3.1-1.32 5.88-1.32 2.1 0 4.32 1.14 5.9 3.12-5.18 2.84-4.34 10.24-1.49 10.52z"/>
    </svg>
  );
}
