import { supabase } from "@/integrations/supabase/client";

function dPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function seedDemoData(userId: string) {
  const items = [
    // 3 urgent (≤2 days)
    { name: "Whole Milk", category: "Dairy", location: "fridge", expiry_date: dPlus(1), price: 1.4 },
    { name: "Chicken Breast", category: "Meat", location: "fridge", expiry_date: dPlus(2), price: 5.5 },
    { name: "Baby Spinach", category: "Vegetables", location: "fridge", expiry_date: dPlus(0), price: 1.8 },
    // 4 amber (3-5 days)
    { name: "Free-range Eggs", category: "Dairy", location: "fridge", expiry_date: dPlus(3), price: 2.6 },
    { name: "Greek Yogurt", category: "Dairy", location: "fridge", expiry_date: dPlus(4), price: 2.2 },
    { name: "Salmon Fillet", category: "Fish", location: "fridge", expiry_date: dPlus(3), price: 6.0 },
    { name: "Sourdough Bread", category: "Grains", location: "cupboard", expiry_date: dPlus(5), price: 3.2 },
    // 5 fresh (7+ days)
    { name: "Mature Cheddar", category: "Dairy", location: "fridge", expiry_date: dPlus(14), price: 3.8 },
    { name: "Baby Carrots", category: "Vegetables", location: "fridge", expiry_date: dPlus(8), price: 1.2 },
    { name: "Leftover Pasta", category: "Leftovers", location: "fridge", expiry_date: dPlus(7), price: 2.0 },
    { name: "Orange Juice", category: "Drinks", location: "fridge", expiry_date: dPlus(10), price: 2.5 },
    { name: "Salted Butter", category: "Dairy", location: "fridge", expiry_date: dPlus(21), price: 2.4 },
  ];
  const rows = items.map((i) => ({ ...i, user_id: userId, status: "active" }));
  const { error } = await supabase.from("food_items").insert(rows);
  if (error) console.error("seed error", error);
}
