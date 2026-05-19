// Saved recipes storage: Supabase for signed-in users, localStorage for guests.

import { supabase } from "@/integrations/supabase/client";
import { isGuest } from "./guest";

export type SavedRecipe = {
  name: string;
  emoji?: string;
  usesItems: string[];
  cookTime: string;
  difficulty: string;
  description: string;
  ingredients: string[];
  steps: string[];
};

const GUEST_KEY = "shelfy:guest:saved-recipes";

export function recipeKey(r: { name: string }): string {
  return r.name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 120);
}

function readGuestSaved(): Array<{ recipe_key: string; recipe: SavedRecipe; created_at: string }> {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeGuestSaved(items: Array<{ recipe_key: string; recipe: SavedRecipe; created_at: string }>) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(items));
}

export async function listSavedRecipes(): Promise<SavedRecipe[]> {
  if (isGuest()) {
    return readGuestSaved()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => r.recipe);
  }
  const { data, error } = await supabase
    .from("saved_recipes")
    .select("recipe, created_at")
    .order("created_at", { ascending: false });
  if (error) return [];
  return ((data as unknown as Array<{ recipe: SavedRecipe }>) || []).map((r) => r.recipe);
}

export async function saveRecipe(r: SavedRecipe): Promise<void> {
  const key = recipeKey(r);
  if (isGuest()) {
    const items = readGuestSaved();
    if (items.some((i) => i.recipe_key === key)) return;
    items.push({ recipe_key: key, recipe: r, created_at: new Date().toISOString() });
    writeGuestSaved(items);
    return;
  }
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  await supabase
    .from("saved_recipes")
    .upsert(
      [{ user_id: u.user.id, recipe_key: key, recipe: r as never }],
      { onConflict: "user_id,recipe_key" },
    );
}

export async function unsaveRecipe(r: SavedRecipe): Promise<void> {
  const key = recipeKey(r);
  if (isGuest()) {
    writeGuestSaved(readGuestSaved().filter((i) => i.recipe_key !== key));
    return;
  }
  await supabase.from("saved_recipes").delete().eq("recipe_key", key);
}
