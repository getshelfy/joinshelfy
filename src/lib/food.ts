export const CATEGORIES = [
  { name: "Dairy", emoji: "🥛" },
  { name: "Meat", emoji: "🥩" },
  { name: "Fish", emoji: "🐟" },
  { name: "Vegetables", emoji: "🥬" },
  { name: "Fruit", emoji: "🍎" },
  { name: "Grains", emoji: "🌾" },
  { name: "Leftovers", emoji: "🍲" },
  { name: "Snacks", emoji: "🍪" },
  { name: "Drinks", emoji: "🧃" },
  { name: "Ready Meals", emoji: "🍱" },
  { name: "Other", emoji: "📦" },
] as const;

export const LOCATIONS = ["fridge", "freezer", "cupboard"] as const;

export function categoryEmoji(cat: string) {
  return CATEGORIES.find((c) => c.name.toLowerCase() === cat.toLowerCase())?.emoji ?? "📦";
}

export function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export type Urgency = "urgent" | "warn" | "fresh";
export function urgencyOf(days: number): Urgency {
  if (days <= 2) return "urgent";
  if (days <= 5) return "warn";
  return "fresh";
}

export function urgencyLabel(days: number) {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

export function guessCategory(name: string, off?: { categories?: string }): string {
  const text = `${name} ${off?.categories || ""}`.toLowerCase();
  const map: Array<[string, string]> = [
    ["milk|yogurt|yoghurt|cheese|butter|cream|dairy", "Dairy"],
    ["chicken|beef|pork|lamb|bacon|sausage|ham|turkey|meat", "Meat"],
    ["salmon|tuna|cod|fish|prawn|shrimp", "Fish"],
    ["spinach|lettuce|carrot|broccoli|cucumber|tomato|onion|pepper|veg", "Vegetables"],
    ["apple|banana|orange|berry|berries|grape|fruit|melon|peach", "Fruit"],
    ["bread|pasta|rice|cereal|oat|flour|grain|noodle", "Grains"],
    ["leftover", "Leftovers"],
    ["chip|crisp|cookie|biscuit|chocolate|snack", "Snacks"],
    ["juice|soda|water|drink|beer|wine|tea|coffee", "Drinks"],
    ["meal|pizza|lasagna|curry|ready", "Ready Meals"],
  ];
  for (const [re, cat] of map) if (new RegExp(re).test(text)) return cat;
  return "Other";
}
