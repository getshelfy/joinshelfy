// Unified data layer: routes Supabase queries for signed-in users,
// localStorage queries for guests. Keeps call sites identical.

import { supabase } from "@/integrations/supabase/client";
import {
  isGuest,
  getGuestId,
  readGuestItems,
  writeGuestItems,
  type GuestItem,
} from "./guest";
import { defaultIncludeInRecipes } from "./food";

export type FoodRow = {
  id: string;
  name: string;
  category: string;
  location: string;
  expiry_date: string | null;
  price: number | null;
  status: string;
  brand?: string | null;
  notes?: string | null;
  is_pantry_staple?: boolean;
  include_in_recipes?: boolean;
  opened_at?: string | null;
  updated_at?: string;
};

export type NewFoodRow = {
  name: string;
  brand?: string | null;
  category: string;
  location: string;
  expiry_date: string | null;
  price?: number | null;
  notes?: string | null;
  is_pantry_staple?: boolean;
  include_in_recipes?: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "g-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const SELECT_COLS = "id,name,category,location,expiry_date,price,status,is_pantry_staple,include_in_recipes,opened_at";

export async function listActiveItems(): Promise<FoodRow[]> {
  // Returns only items being tracked for expiry — pantry staples excluded.
  if (isGuest()) {
    return readGuestItems()
      .filter((i) => i.status === "active" && !i.is_pantry_staple)
      .sort((a, b) => (a.expiry_date || "").localeCompare(b.expiry_date || ""));
  }
  const { data, error } = await supabase
    .from("food_items")
    .select(SELECT_COLS)
    .eq("status", "active")
    .eq("is_pantry_staple", false)
    .order("expiry_date", { ascending: true });
  if (error) throw error;
  return (data as FoodRow[]) || [];
}

export async function listPantryStaples(): Promise<FoodRow[]> {
  if (isGuest()) {
    return readGuestItems()
      .filter((i) => i.status === "active" && i.is_pantry_staple)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const { data, error } = await supabase
    .from("food_items")
    .select(SELECT_COLS)
    .eq("status", "active")
    .eq("is_pantry_staple", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as FoodRow[]) || [];
}

export async function insertItems(rows: NewFoodRow[]): Promise<void> {
  if (!rows.length) return;
  if (isGuest()) {
    const uid = getGuestId();
    const t = nowIso();
    const items = readGuestItems();
    const next: GuestItem[] = [
      ...items,
      ...rows.map((r) => ({
        id: uuid(),
        user_id: uid,
        name: r.name,
        brand: r.brand ?? null,
        category: r.category,
        location: r.location,
        expiry_date: r.expiry_date,
        price: r.price ?? 0,
        status: "active",
        notes: r.notes ?? null,
        is_pantry_staple: r.is_pantry_staple ?? false,
        include_in_recipes: r.include_in_recipes ?? defaultIncludeInRecipes(r.category),
        created_at: t,
        updated_at: t,
      })),
    ];
    writeGuestItems(next);
    return;
  }
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const payload = rows.map((r) => ({
    user_id: u.user!.id,
    name: r.name,
    brand: r.brand ?? null,
    category: r.category,
    location: r.location,
    expiry_date: r.expiry_date,
    price: r.price ?? 0,
    notes: r.notes ?? null,
    is_pantry_staple: r.is_pantry_staple ?? false,
    include_in_recipes: r.include_in_recipes ?? defaultIncludeInRecipes(r.category),
  }));
  const { error } = await supabase.from("food_items").insert(payload);
  if (error) throw error;
}

export async function updateItemStatus(id: string, status: "used" | "wasted" | "active"): Promise<void> {
  if (isGuest()) {
    const items = readGuestItems();
    const t = nowIso();
    writeGuestItems(items.map((i) => (i.id === id ? { ...i, status, updated_at: t } : i)));
    return;
  }
  const { error } = await supabase.from("food_items").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function updateItemRecipeFlag(id: string, include: boolean): Promise<void> {
  if (isGuest()) {
    const items = readGuestItems();
    const t = nowIso();
    writeGuestItems(items.map((i) => (i.id === id ? { ...i, include_in_recipes: include, updated_at: t } : i)));
    return;
  }
  const { error } = await supabase.from("food_items").update({ include_in_recipes: include }).eq("id", id);
  if (error) throw error;
}

export async function listClosedSince(sinceIso: string): Promise<FoodRow[]> {
  if (isGuest()) {
    return readGuestItems().filter(
      (i) => (i.status === "used" || i.status === "wasted") && i.updated_at >= sinceIso,
    );
  }
  const { data, error } = await supabase
    .from("food_items")
    .select("category,price,status,updated_at")
    .in("status", ["used", "wasted"])
    .gte("updated_at", sinceIso);
  if (error) throw error;
  return (data as FoodRow[]) || [];
}

export async function sumUsedSince(sinceIso: string): Promise<number> {
  if (isGuest()) {
    return readGuestItems()
      .filter((i) => i.status === "used" && i.updated_at >= sinceIso)
      .reduce((s, r) => s + Number(r.price || 0), 0);
  }
  const { data } = await supabase
    .from("food_items")
    .select("price")
    .eq("status", "used")
    .gte("updated_at", sinceIso);
  return (data || []).reduce((s, r: any) => s + Number(r.price || 0), 0);
}

export type RecipeIngredient = { name: string; category: string; expiry_date: string | null; pantry_staple: boolean };

export async function listItemsForRecipes(limit = 8): Promise<{ expiring: RecipeIngredient[]; staples: RecipeIngredient[] }> {
  if (isGuest()) {
    const all = readGuestItems().filter((i) => i.status === "active" && i.include_in_recipes !== false);
    const expiring = all
      .filter((i) => !i.is_pantry_staple)
      .sort((a, b) => (a.expiry_date || "").localeCompare(b.expiry_date || ""))
      .slice(0, limit)
      .map((i) => ({ name: i.name, category: i.category, expiry_date: i.expiry_date, pantry_staple: false }));
    const staples = all
      .filter((i) => i.is_pantry_staple)
      .map((i) => ({ name: i.name, category: i.category, expiry_date: null, pantry_staple: true }));
    return { expiring, staples };
  }
  const { data, error } = await supabase
    .from("food_items")
    .select("name,category,expiry_date,is_pantry_staple,include_in_recipes")
    .eq("status", "active")
    .eq("include_in_recipes", true);
  if (error) throw error;
  const rows = (data as any[]) || [];
  const expiring = rows
    .filter((r) => !r.is_pantry_staple)
    .sort((a, b) => (a.expiry_date || "").localeCompare(b.expiry_date || ""))
    .slice(0, limit)
    .map((r) => ({ name: r.name, category: r.category, expiry_date: r.expiry_date, pantry_staple: false }));
  const staples = rows
    .filter((r) => r.is_pantry_staple)
    .map((r) => ({ name: r.name, category: r.category, expiry_date: null, pantry_staple: true }));
  return { expiring, staples };
}

export function seedGuestDemo() {
  const dPlus = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const items = [
    { name: "Whole Milk", category: "Dairy", location: "fridge", expiry_date: dPlus(1), price: 1.4 },
    { name: "Chicken Breast", category: "Meat", location: "fridge", expiry_date: dPlus(2), price: 5.5 },
    { name: "Baby Spinach", category: "Vegetables", location: "fridge", expiry_date: dPlus(0), price: 1.8 },
    { name: "Free-range Eggs", category: "Dairy", location: "fridge", expiry_date: dPlus(3), price: 2.6 },
    { name: "Greek Yogurt", category: "Dairy", location: "fridge", expiry_date: dPlus(4), price: 2.2 },
    { name: "Salmon Fillet", category: "Fish", location: "fridge", expiry_date: dPlus(3), price: 6.0 },
    { name: "Sourdough Bread", category: "Grains", location: "cupboard", expiry_date: dPlus(5), price: 3.2 },
    { name: "Mature Cheddar", category: "Dairy", location: "fridge", expiry_date: dPlus(14), price: 3.8 },
    { name: "Baby Carrots", category: "Vegetables", location: "fridge", expiry_date: dPlus(8), price: 1.2 },
    { name: "Leftover Pasta", category: "Leftovers", location: "fridge", expiry_date: dPlus(7), price: 2.0 },
    { name: "Orange Juice", category: "Drinks", location: "fridge", expiry_date: dPlus(10), price: 2.5 },
    { name: "Salted Butter", category: "Dairy", location: "fridge", expiry_date: dPlus(21), price: 2.4 },
  ];
  return insertItems(items);
}
