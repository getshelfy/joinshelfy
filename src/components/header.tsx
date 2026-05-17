import { Link } from "@tanstack/react-router";
import { Sprout } from "lucide-react";

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-5 pt-7 pb-4">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sprout className="h-4 w-4" />
          </span>
          <span className="font-serif text-lg font-semibold">Shelfy</span>
        </Link>
      </div>
      <h1 className="mt-5 font-serif text-3xl font-semibold leading-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </header>
  );
}
