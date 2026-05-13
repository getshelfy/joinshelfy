import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, LogOut, Trash2, FileText, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { endGuest, isGuest } from "@/lib/guest";
import { deleteAccount } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, isGuest: guest } = useAuth();
  const navigate = useNavigate();
  const callDelete = useServerFn(deleteAccount);
  const [deleting, setDeleting] = useState(false);

  const handleSignOut = async () => {
    if (isGuest()) endGuest();
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (guest) {
        endGuest();
      } else {
        await callDelete();
        await supabase.auth.signOut();
      }
      navigate({ to: "/login" });
    } catch (e) {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background pb-12">
      <header className="flex items-center gap-2 px-5 pt-7 pb-4">
        <Link
          to="/"
          aria-label="Back"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-serif text-2xl font-semibold">Settings</h1>
      </header>

      <main className="flex-1 px-5 space-y-6">
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Account
          </h2>
          <p className="mt-2 text-sm">
            {guest ? "Guest (data on this device)" : user?.email}
          </p>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="mt-4 w-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Legal
          </h2>
          <a
            href="https://tryshelfy.com/terms"
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center gap-3 rounded-lg p-2 text-sm hover:bg-muted"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            Terms of Service
          </a>
          <a
            href="https://tryshelfy.com/privacy"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg p-2 text-sm hover:bg-muted"
          >
            <Shield className="h-4 w-4 text-muted-foreground" />
            Privacy Policy
          </a>
        </section>

        <section className="rounded-2xl border border-destructive/30 bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-destructive uppercase tracking-wide">
            Danger zone
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="mt-4 w-full">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account and all your pantry
                  data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </main>
    </div>
  );
}
