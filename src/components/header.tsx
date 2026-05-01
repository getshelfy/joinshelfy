import { Link } from "@tanstack/react-router";
import { LogOut, Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };
  return (
    <header className="px-5 pt-7 pb-4">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sprout className="h-4 w-4" />
          </span>
          <span className="font-serif text-lg font-semibold">Shelfy</span>
        </Link>
        <button
          onClick={handleSignOut}
          aria-label="Sign out"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      <h1 className="mt-5 font-serif text-3xl font-semibold leading-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </header>
  );
}
