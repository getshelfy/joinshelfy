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

export type FoodRow = {
  id: string;
  name: string;
  category: string;
  location: string;
  expiry_date: string;
  price: number | null;
  status: string;
  brand?: string | null;
  notes?: string | null;
  updated_at?: string;
};

export type NewFoodRow = {
  name: string;
  brand?: string | null;
  category: string;
  location: string;
  expiry_date: string;
  price?: number | null;
  notes?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "g-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function listActiveItems(): Promise<FoodRow[]> {
  if (isGuest()) {
    return readGuestItems()
      .filter((i) => i.status === "active")
      .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
  }
  const { data, error } = await supabase
    .from("food_items")
    .select("id,name,category,location,expiry_date,price,status")
    .eq("status", "active")
    .order("expiry_date", { ascending: true });
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

export async function listActiveForRecipes(limit = 8): Promise<Array<{ name: string; category: string; expiry_date: string }>> {
  if (isGuest()) {
    return readGuestItems()
      .filter((i) => i.status === "active")
      .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
      .slice(0, limit)
      .map((i) => ({ name: i.name, category: i.category, expiry_date: i.expiry_date }));
  }
  const { data, error } = await supabase
    .from("food_items")
    .select("name,category,expiry_date")
    .eq("status", "active")
    .order("expiry_date", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data as any) || [];
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
