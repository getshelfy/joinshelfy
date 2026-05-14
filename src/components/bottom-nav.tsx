import { Link, useLocation } from "@tanstack/react-router";
import { Home, Plus, ChefHat, BarChart3, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/pantry", label: "Pantry", icon: ListChecks },
  { to: "/add", label: "Add", icon: Plus },
  { to: "/recipes", label: "Recipes", icon: ChefHat },
  { to: "/insights", label: "Insights", icon: BarChart3 },
] as const;

export function BottomNav() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          const isAdd = to === "/add";
          return (
            <Link
              key={to}
              to={to}
              onClick={tap}
              className={cn(
                "tactile group relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-xs",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && !isAdd && (
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary animate-nav-indicator"
                />
              )}
              <span
                className={cn(
                  "flex items-center justify-center rounded-full",
                  "transition-[transform,background-color,box-shadow,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isAdd
                    ? "h-11 w-11 bg-primary text-primary-foreground shadow-md -mt-3 group-active:scale-90 group-active:shadow-sm"
                    : "h-7 w-7",
                  active && !isAdd && "scale-110 -translate-y-0.5",
                  !active && !isAdd && "group-active:scale-90",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-300",
                    active && !isAdd && "drop-shadow-sm",
                  )}
                />
              </span>
              <span
                className={cn(
                  "font-medium transition-opacity duration-200",
                  isAdd && "sr-only",
                  !active && !isAdd && "opacity-80",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
