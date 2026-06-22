import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sprout, MailCheck, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/verify")({
  component: VerifyPage,
});

function VerifyPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let resolved = false;
    let fallbackTimer: ReturnType<typeof setTimeout>;

    const handleSession = (session: any) => {
      if (resolved) return;
      if (session) {
        resolved = true;
        clearTimeout(fallbackTimer);
        setStatus("success");
        setTimeout(() => navigate({ to: "/" }), 800);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        handleSession(session);
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setError(error.message);
        setStatus("error");
        resolved = true;
        return;
      }
      handleSession(data.session);
    });

    fallbackTimer = setTimeout(() => {
      if (!resolved) {
        setStatus("error");
        setError("Verification link may have expired or is invalid. Please try signing in again.");
      }
    }, 8000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pb-8 pt-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
          <Sprout className="h-6 w-6" />
        </div>

        {status === "verifying" && (
          <>
            <h1 className="font-serif text-2xl font-semibold">Verifying your email...</h1>
            <p className="mt-2 text-sm text-muted-foreground">Just a moment while we sign you in.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="h-5 w-5 text-primary" />
            </div>
            <h1 className="font-serif text-2xl font-semibold">Email verified!</h1>
            <p className="mt-2 text-sm text-muted-foreground">Redirecting you to your pantry...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <h1 className="font-serif text-2xl font-semibold">Could not verify</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <a href="/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
              Back to sign in
            </a>
          </>
        )}
      </div>
    </div>
  );
}
