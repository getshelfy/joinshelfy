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
                "tactile flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-xs",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-full transition-all duration-200",
                  isAdd
                    ? "h-11 w-11 bg-primary text-primary-foreground shadow-md -mt-3 active:shadow-sm"
                    : "h-7 w-7",
                  active && !isAdd && "scale-110",
                )}
              >
                <Icon className={cn(isAdd ? "h-5 w-5" : "h-5 w-5")} />
              </span>
              <span className={cn("font-medium", isAdd && "sr-only")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
