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
import { Sparkles, Clock, ChefHat, Loader2, RefreshCw, Flame, Check, PartyPopper, Bookmark, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { tap, tapLight, tapSelect, tapSuccess } from "@/lib/haptics";
import { listSavedRecipes, saveRecipe, unsaveRecipe, recipeKey, type SavedRecipe } from "@/lib/saved-recipes";
import { isGuest } from "@/lib/guest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

type Tab = "kitchen" | "use-first" | "saved";

function RecipesPage() {
  const [expiring, setExpiring] = useState<RecipeIngredient[]>([]);
  const [staples, setStaples] = useState<RecipeIngredient[]>([]);
  const [pantryReady, setPantryReady] = useState(false);

  const [kitchenRecipes, setKitchenRecipes] = useState<Recipe[]>([]);
  const [urgentRecipes, setUrgentRecipes] = useState<Recipe[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [kitchenLoading, setKitchenLoading] = useState(true);
  const [urgentLoading, setUrgentLoading] = useState(false);
  const [guest, setGuest] = useState(false);

  const urgentNames = useMemo(() => {
    const set = new Set<string>();
    for (const i of expiring) {
      const d = i.expiry_date ? daysUntil(i.expiry_date) : 999;
      if (d <= 2) set.add(i.name.toLowerCase());
    }
    return set;
  }, [expiring]);

  const hasUrgent = urgentNames.size > 0;
  const hasSaved = savedRecipes.length > 0;
  const [tab, setTab] = useState<Tab>("kitchen");

  useEffect(() => {
    if (!hasUrgent && tab === "use-first") setTab("kitchen");
    if (!hasSaved && tab === "saved") setTab("kitchen");
  }, [hasUrgent, hasSaved, tab]);

  const reloadSaved = async () => {
    try {
      setSavedRecipes(await listSavedRecipes());
    } catch {
      setSavedRecipes([]);
    }
  };

  const savedKeys = useMemo(() => new Set(savedRecipes.map((r) => recipeKey(r))), [savedRecipes]);

  const onToggleSaved = async (r: Recipe, currentlySaved: boolean) => {
    if (currentlySaved) {
      await unsaveRecipe(r);
    } else {
      await saveRecipe(r);
    }
    await reloadSaved();
  };

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
    setGuest(isGuest());
    reloadSaved();
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
            hasUrgent && hasSaved
              ? "grid-cols-3"
              : hasUrgent || hasSaved
                ? "grid-cols-2"
                : "grid-cols-1",
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
          {hasSaved && (
            <TabButton
              active={tab === "saved"}
              label={`Saved (${savedRecipes.length})`}
              icon={<Bookmark className="h-4 w-4" />}
              onClick={() => {
                tap();
                setTab("saved");
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
            pantry={allPantry}
            onItemsConsumed={onItemsConsumed}
            onRefresh={() => onRefresh("kitchen")}
            staples={staples}
            emptyHint="Add some items to your pantry first."
            savedKeys={savedKeys}
            onToggleSaved={onToggleSaved}
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
            pantry={allPantry}
            onItemsConsumed={onItemsConsumed}
            onRefresh={() => onRefresh("use-first")}
            savedKeys={savedKeys}
            onToggleSaved={onToggleSaved}
          />
        )}

        {tab === "saved" && (
          <SavedSection
            recipes={savedRecipes}
            urgentNames={urgentNames}
            pantry={allPantry}
            onItemsConsumed={onItemsConsumed}
            savedKeys={savedKeys}
            onToggleSaved={onToggleSaved}
            guest={guest}
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
  pantry,
  onItemsConsumed,
  savedKeys,
  onToggleSaved,
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
  pantry: RecipeIngredient[];
  onItemsConsumed: () => void | Promise<void>;
  savedKeys: Set<string>;
  onToggleSaved: (r: Recipe, currentlySaved: boolean) => Promise<void>;
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
            <RecipeCard
              r={r}
              urgentNames={urgentNames}
              tone={tone}
              pantry={pantry}
              onItemsConsumed={onItemsConsumed}
              isSaved={savedKeys.has(recipeKey(r))}
              onToggleSaved={onToggleSaved}
            />
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
  pantry,
  onItemsConsumed,
}: {
  r: Recipe;
  urgentNames: Set<string>;
  tone?: "urgent";
  pantry: RecipeIngredient[];
  onItemsConsumed: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [madeOpen, setMadeOpen] = useState(false);
  const isUrgent = (name: string) => urgentNames.has(name.toLowerCase());

  // Match recipe usesItems to actual pantry rows (case-insensitive substring)
  const matchedPantry = useMemo(() => {
    const matches: RecipeIngredient[] = [];
    const seen = new Set<string>();
    for (const u of r.usesItems) {
      const needle = u.toLowerCase().trim();
      const found = pantry.find(
        (p) =>
          !seen.has(p.id) &&
          (p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase())),
      );
      if (found) {
        matches.push(found);
        seen.add(found.id);
      }
    }
    return matches;
  }, [r.usesItems, pantry]);

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
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          onClick={() => {
            tap();
            setOpen(!open);
          }}
          className="tactile inline-flex items-center gap-1 text-sm font-medium text-primary"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {open ? "Hide" : "Show"} recipe
        </button>
        <button
          onClick={() => {
            tap();
            setMadeOpen(true);
          }}
          disabled={matchedPantry.length === 0}
          className="tactile inline-flex items-center gap-1 rounded-full bg-fresh px-3 py-1 text-xs font-semibold text-fresh-foreground ring-1 ring-fresh-foreground/20 disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" />
          Made it
        </button>
      </div>
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
          <Button
            onClick={() => {
              tap();
              setMadeOpen(true);
            }}
            disabled={matchedPantry.length === 0}
            className="tactile w-full h-11 bg-fresh-foreground text-fresh hover:bg-fresh-foreground/90"
          >
            <Check className="mr-2 h-4 w-4" />
            I made this ✓
          </Button>
          {matchedPantry.length === 0 && (
            <p className="text-xs text-muted-foreground text-center">
              No matching pantry items to log.
            </p>
          )}
        </div>
      )}

      <MadeItDialog
        open={madeOpen}
        onOpenChange={setMadeOpen}
        recipeName={r.name}
        items={matchedPantry}
        onConfirmed={onItemsConsumed}
      />
    </article>
  );
}

function MadeItDialog({
  open,
  onOpenChange,
  recipeName,
  items,
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipeName: string;
  items: RecipeIngredient[];
  onConfirmed: () => void | Promise<void>;
}) {
  type Phase = "select" | "saving" | "celebrate" | "summary";
  const [phase, setPhase] = useState<Phase>("select");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState<{ count: number; saved: number }>({ count: 0, saved: 0 });

  useEffect(() => {
    if (open) {
      setPhase("select");
      const init: Record<string, boolean> = {};
      for (const i of items) init[i.id] = true;
      setChecked(init);
    }
  }, [open, items]);

  const toggle = (id: string) => {
    tapSelect();
    setChecked((c) => ({ ...c, [id]: !c[id] }));
  };

  const confirm = async () => {
    const toUse = items.filter((i) => checked[i.id]);
    if (!toUse.length) {
      onOpenChange(false);
      return;
    }
    setPhase("saving");
    const saved = toUse.reduce((s, i) => s + Number(i.price || 0), 0);
    try {
      await Promise.all(toUse.map((i) => updateItemStatus(i.id, "used")));
      tapSuccess();
      setSummary({ count: toUse.length, saved });
      setPhase("celebrate");
      await onConfirmed();
      setTimeout(() => setPhase("summary"), 1100);
    } catch {
      setPhase("select");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {phase === "select" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif">I made {recipeName}</DialogTitle>
              <DialogDescription>
                Uncheck anything you didn't fully use. Checked items will be removed from your pantry.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-72 overflow-y-auto space-y-2 py-2">
              {items.map((i) => {
                const isChecked = !!checked[i.id];
                return (
                  <label
                    key={i.id}
                    className="tactile flex items-center gap-3 rounded-xl border bg-card-soft/40 p-3 cursor-pointer"
                  >
                    <Checkbox checked={isChecked} onCheckedChange={() => toggle(i.id)} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{i.name}</div>
                      <div className="text-xs text-muted-foreground">{i.category}</div>
                    </div>
                    {i.expiry_date && daysUntil(i.expiry_date) <= 2 && (
                      <span className="text-xs font-medium text-urgent-foreground">🔴 Expiring</span>
                    )}
                  </label>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="tactile">
                Cancel
              </Button>
              <Button
                onClick={confirm}
                className="tactile bg-fresh-foreground text-fresh hover:bg-fresh-foreground/90"
              >
                <Check className="mr-2 h-4 w-4" />
                Confirm
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "saving" && (
          <div className="py-12 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Updating your pantry…</p>
          </div>
        )}

        {phase === "celebrate" && (
          <div className="py-12 flex flex-col items-center gap-3 animate-page-in">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-fresh-foreground text-fresh shadow-lg animate-tile-in">
                <Check className="h-10 w-10" strokeWidth={3} />
              </div>
              <Confetti />
            </div>
            <p className="font-serif text-lg">Logged!</p>
          </div>
        )}

        {phase === "summary" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif flex items-center gap-2">
                <PartyPopper className="h-5 w-5 text-fresh-foreground" />
                Nice work
              </DialogTitle>
              <DialogDescription>
                You used up {summary.count} {summary.count === 1 ? "item" : "items"}
                {summary.saved > 0 && ` and avoided wasting £${summary.saved.toFixed(2)}`}.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => onOpenChange(false)}
                className="tactile w-full bg-fresh-foreground text-fresh hover:bg-fresh-foreground/90"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 14 });
  return (
    <div className="pointer-events-none absolute inset-0">
      {pieces.map((_, i) => {
        const angle = (i / pieces.length) * 360;
        const dist = 50 + Math.random() * 30;
        const x = Math.cos((angle * Math.PI) / 180) * dist;
        const y = Math.sin((angle * Math.PI) / 180) * dist;
        const colors = ["bg-fresh-foreground", "bg-urgent-foreground", "bg-primary", "bg-fresh"];
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            className={cn("absolute left-1/2 top-1/2 h-2 w-2 rounded-sm", color)}
            style={{
              animation: `confetti-fly 900ms cubic-bezier(0.22,1,0.36,1) forwards`,
              ["--cx" as any]: `${x}px`,
              ["--cy" as any]: `${y}px`,
            }}
          />
        );
      })}
    </div>
  );
}

