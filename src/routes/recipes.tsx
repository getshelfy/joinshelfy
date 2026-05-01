import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/header";
import { supabase } from "@/integrations/supabase/client";
import { daysUntil } from "@/lib/food";
import { Button } from "@/components/ui/button";
import { Sparkles, Clock, ChefHat, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasItems, setHasItems] = useState(true);

  const generate = async () => {
    setLoading(true);
    setRecipes([]);
    try {
      const { data: items, error } = await supabase
        .from("food_items")
        .select("name,category,expiry_date")
        .eq("status", "active")
        .order("expiry_date", { ascending: true })
        .limit(8);
      if (error) throw error;
      if (!items || items.length === 0) {
        setHasItems(false);
        return;
      }
      setHasItems(true);
      const payload = items.map((i: any) => ({
        name: i.name,
        category: i.category,
        daysLeft: daysUntil(i.expiry_date),
      }));
      const { data, error: fnErr } = await supabase.functions.invoke("generate-recipes", {
        body: { items: payload },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setRecipes(data?.recipes || []);
    } catch (e: any) {
      toast.error(e.message || "Recipe generation failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Header title="Tonight's ideas" subtitle="Use what's about to expire — no shop needed." />

      <div className="px-5">
        <Button onClick={generate} disabled={loading} className="w-full h-11">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {loading ? "Cooking up ideas..." : "Generate new recipes"}
        </Button>

        {!hasItems && (
          <div className="mt-8 rounded-2xl border bg-card p-6 text-center">
            <ChefHat className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Add some items to your pantry first.</p>
          </div>
        )}

        {loading && recipes.length === 0 && (
          <div className="mt-8 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-card-soft" />
            ))}
          </div>
        )}

        <div className="mt-5 space-y-3 pb-4">
          {recipes.map((r, i) => (
            <RecipeCard key={i} r={r} />
          ))}
        </div>
      </div>
    </>
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

function RecipeCard({ r }: { r: Recipe }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-2xl border bg-card p-4">
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
        {r.usesItems.slice(0, 3).map((u) => (
          <span key={u} className="inline-flex rounded-full bg-fresh px-2 py-0.5 text-fresh-foreground">
            {u}
          </span>
        ))}
      </div>
      <button onClick={() => setOpen(!open)} className="mt-3 text-sm font-medium text-primary">
        {open ? "Hide" : "Show"} recipe
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t pt-3 text-sm">
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
