import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/header";
import { supabase } from "@/integrations/supabase/client";
import { listItemsForRecipes, updateItemStatus, type RecipeIngredient } from "@/lib/db";
import { daysUntil } from "@/lib/food";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles, Clock, ChefHat, Loader2, RefreshCw, Flame, Check, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { tap, tapLight, tapSelect, tapSuccess } from "@/lib/haptics";

export const Route = createFileRoute("/recipes")({
  component: () => (
    <AppShell>
      <RecipesPage />
    </AppShell>
  ),
});

type Recipe = {
  name: string;
  emoji?: string;
  usesItems: string[];
  cookTime: string;
  difficulty: string;
  description: string;
  ingredients: string[];
  steps: string[];
};

type Tab = "kitchen" | "use-first";

function RecipesPage() {
  const [expiring, setExpiring] = useState<RecipeIngredient[]>([]);
  const [staples, setStaples] = useState<RecipeIngredient[]>([]);
  const [pantryReady, setPantryReady] = useState(false);

  const [kitchenRecipes, setKitchenRecipes] = useState<Recipe[]>([]);
  const [urgentRecipes, setUrgentRecipes] = useState<Recipe[]>([]);
  const [kitchenLoading, setKitchenLoading] = useState(true);
  const [urgentLoading, setUrgentLoading] = useState(false);

  const urgentNames = useMemo(() => {
    const set = new Set<string>();
    for (const i of expiring) {
      const d = i.expiry_date ? daysUntil(i.expiry_date) : 999;
      if (d <= 2) set.add(i.name.toLowerCase());
    }
    return set;
  }, [expiring]);

  const hasUrgent = urgentNames.size > 0;
  const [tab, setTab] = useState<Tab>("kitchen");

  useEffect(() => {
    if (!hasUrgent && tab === "use-first") setTab("kitchen");
  }, [hasUrgent, tab]);

  const loadPantry = async () => {
    const { expiring: ex, staples: stps } = await listItemsForRecipes(12);
    setExpiring(ex);
    setStaples(stps);
    setPantryReady(true);
    return { ex, stps };
  };

  const generate = async (mode: Tab, source?: { ex: RecipeIngredient[]; stps: RecipeIngredient[] }) => {
    const ex = source?.ex ?? expiring;
    const stps = source?.stps ?? staples;
    if (mode === "kitchen") {
      if (!ex.length) {
        setKitchenRecipes([]);
        return;
      }
      setKitchenLoading(true);
      setKitchenRecipes([]);
    } else {
      const urgent = ex.filter((i) => i.expiry_date && daysUntil(i.expiry_date) <= 2);
      if (!urgent.length) {
        setUrgentRecipes([]);
        return;
      }
      setUrgentLoading(true);
      setUrgentRecipes([]);
    }
    try {
      const items =
        mode === "use-first"
          ? ex.filter((i) => i.expiry_date && daysUntil(i.expiry_date) <= 2)
          : ex;
      const payload = items.map((i) => ({
        name: i.name,
        category: i.category,
        daysLeft: i.expiry_date ? daysUntil(i.expiry_date) : null,
      }));
      const staplesPayload = stps.map((i) => ({ name: i.name, category: i.category }));
      const { data, error } = await supabase.functions.invoke("generate-recipes", {
        body: { items: payload, staples: staplesPayload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result: Recipe[] = data?.recipes || [];
      if (mode === "use-first") setUrgentRecipes(result.slice(0, 3));
      else setKitchenRecipes(result);
    } catch {
      // ignore
    } finally {
      if (mode === "kitchen") setKitchenLoading(false);
      else setUrgentLoading(false);
    }
  };

  useEffect(() => {
    tapLight();
    (async () => {
      const src = await loadPantry();
      const urgent = src.ex.filter((i) => i.expiry_date && daysUntil(i.expiry_date) <= 2);
      if (urgent.length) {
        setUrgentLoading(true);
        generate("use-first", { ex: src.ex, stps: src.stps });
      }
      generate("kitchen", { ex: src.ex, stps: src.stps });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = (mode: Tab) => {
    tapSelect();
    generate(mode);
  };

  const allPantry = useMemo(() => [...expiring, ...staples], [expiring, staples]);

  const onItemsConsumed = async () => {
    // Reload pantry so urgent list updates immediately
    await loadPantry();
  };

  return (
    <>
      <Header title="Tonight's ideas" subtitle="Cook from what you've got." />

      <div className="px-5">
        {/* Tabs */}
        <div
          role="tablist"
          className={cn(
            "grid gap-2 rounded-2xl bg-card-soft p-1",
            hasUrgent ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          <TabButton
            active={tab === "kitchen"}
            label="From your kitchen"
            onClick={() => {
              tap();
              setTab("kitchen");
            }}
          />
          {hasUrgent && (
            <TabButton
              active={tab === "use-first"}
              label="Use First"
              tone="urgent"
              icon={<Flame className="h-4 w-4" />}
              onClick={() => {
                tap();
                setTab("use-first");
              }}
            />
          )}
        </div>

        {tab === "kitchen" && (
          <Section
            key="kitchen"
            title="From your kitchen"
            subtitle="Suggestions using what you've got, prioritising what expires soonest."
            recipes={kitchenRecipes}
            loading={kitchenLoading}
            ready={pantryReady}
            urgentNames={urgentNames}
            onRefresh={() => onRefresh("kitchen")}
            staples={staples}
            emptyHint="Add some items to your pantry first."
          />
        )}

        {tab === "use-first" && hasUrgent && (
          <Section
            key="use-first"
            title="Use these up today"
            subtitle="Recipes built only from items expiring in the next 2 days."
            tone="urgent"
            recipes={urgentRecipes}
            loading={urgentLoading}
            ready={pantryReady}
            urgentNames={urgentNames}
            onRefresh={() => onRefresh("use-first")}
          />
        )}
      </div>
    </>
  );
}

function TabButton({
  active,
  label,
  onClick,
  tone,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  tone?: "urgent";
  icon?: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "tactile relative flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium",
        "transition-colors duration-200",
        active
          ? tone === "urgent"
            ? "bg-urgent text-urgent-foreground shadow-sm"
            : "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Section({
  title,
  subtitle,
  recipes,
  loading,
  ready,
  urgentNames,
  onRefresh,
  tone,
  staples,
  emptyHint,
}: {
  title: string;
  subtitle: string;
  recipes: Recipe[];
  loading: boolean;
  ready: boolean;
  urgentNames: Set<string>;
  onRefresh: () => void;
  tone?: "urgent";
  staples?: RecipeIngredient[];
  emptyHint?: string;
}) {
  return (
    <section className="mt-4 animate-page-in">
      <div
        className={cn(
          "rounded-2xl border p-4",
          tone === "urgent" ? "border-urgent-foreground/30 bg-urgent/30" : "bg-card-soft/40",
        )}
      >
        <h2
          className={cn(
            "font-serif text-lg font-semibold",
            tone === "urgent" && "text-urgent-foreground",
          )}
        >
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>

      {loading && recipes.length === 0 && (
        <div className="mt-3 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-card-soft" />
          ))}
        </div>
      )}

      {!loading && ready && recipes.length === 0 && (
        <div className="mt-3 rounded-2xl border bg-card p-6 text-center">
          <ChefHat className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {emptyHint ?? "No recipes right now. Try refreshing."}
          </p>
        </div>
      )}

      <div className="mt-3 space-y-3">
        {recipes.map((r, i) => (
          <div
            key={i}
            className="animate-tile-in"
            style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
          >
            <RecipeCard r={r} urgentNames={urgentNames} tone={tone} />
          </div>
        ))}
      </div>

      {(recipes.length > 0 || (!loading && ready)) && (
        <div className="mt-4 mb-2">
          <Button
            onClick={onRefresh}
            disabled={loading}
            variant="default"
            className={cn(
              "tactile w-full h-11",
              tone === "urgent"
                ? "bg-urgent-foreground/90 text-urgent hover:bg-urgent-foreground"
                : "bg-fresh-foreground text-fresh hover:bg-fresh-foreground/90",
            )}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {loading ? "Cooking up ideas…" : "Refresh recipes"}
          </Button>
        </div>
      )}

      {staples && staples.length > 0 && (
        <div className="mt-3 mb-6 rounded-2xl border bg-card-soft p-4">
          <h3 className="font-serif text-base">Also available in your pantry</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Staples factored into the recipes above.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {staples.map((s) => (
              <span key={s.name} className="inline-flex rounded-full bg-card px-2 py-0.5 text-xs">
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function pickEmoji(r: Recipe): string {
  if (r.emoji && r.emoji !== "🍽️" && r.emoji !== "🍽") return r.emoji;
  const n = r.name.toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/pasta|spaghetti|linguine|penne|carbonara|bolognese|lasagn/, "🍝"],
    [/noodle|ramen|pho|udon/, "🍜"],
    [/pizza/, "🍕"],
    [/burger/, "🍔"],
    [/taco|burrito|quesadilla/, "🌮"],
    [/sandwich|toastie|panini|wrap/, "🥪"],
    [/salad|slaw/, "🥗"],
    [/soup|broth|stew|chowder/, "🍲"],
    [/curry|tikka|masala|dahl|dal/, "🍛"],
    [/stir.?fry|wok/, "🥘"],
    [/risotto|paella|rice|pilaf|biryani/, "🍚"],
    [/sushi|sashimi|maki/, "🍣"],
    [/omelette|frittata|scramble|egg|shakshuka/, "🍳"],
    [/pancake|crepe|waffle/, "🥞"],
    [/bread|toast|bruschetta/, "🍞"],
    [/croissant|pastry|scone/, "🥐"],
    [/cake|cookie|brownie|crumble|pie|tart|dessert/, "🍰"],
    [/smoothie|shake|juice/, "🥤"],
    [/chicken|roast|poultry/, "🍗"],
    [/fish|salmon|tuna|cod/, "🐟"],
    [/shrimp|prawn/, "🦐"],
    [/beef|steak/, "🥩"],
    [/cheese|fondue/, "🧀"],
    [/veg|vegetable|roast veg/, "🥦"],
  ];
  for (const [re, e] of map) if (re.test(n)) return e;
  return "🥘";
}

function RecipeCard({
  r,
  urgentNames,
  tone,
}: {
  r: Recipe;
  urgentNames: Set<string>;
  tone?: "urgent";
}) {
  const [open, setOpen] = useState(false);
  const isUrgent = (name: string) => urgentNames.has(name.toLowerCase());

  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm transition-colors",
        tone === "urgent" && "border-urgent-foreground/20",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card-soft text-2xl">
          {pickEmoji(r)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg font-semibold leading-tight">{r.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-card-soft px-2 py-0.5">
          <Clock className="h-3 w-3" />
          {r.cookTime}
        </span>
        <span className="inline-flex rounded-full bg-card-soft px-2 py-0.5">{r.difficulty}</span>
        {r.usesItems.map((u) => {
          const urgent = isUrgent(u);
          return (
            <span
              key={u}
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 font-medium",
                urgent
                  ? "bg-urgent text-urgent-foreground ring-1 ring-urgent-foreground/30"
                  : "bg-fresh text-fresh-foreground",
              )}
            >
              {urgent && <span className="mr-1" aria-hidden>🔴</span>}
              {u}
            </span>
          );
        })}
      </div>
      <button
        onClick={() => {
          tap();
          setOpen(!open);
        }}
        className="tactile mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {open ? "Hide" : "Show"} recipe
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t pt-3 text-sm animate-page-in">
          <div>
            <h4 className="font-serif text-base">Ingredients</h4>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              {r.ingredients.map((ing, i) => (
                <li key={i}>{ing}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-serif text-base">Method</h4>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
              {r.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </article>
  );
}
