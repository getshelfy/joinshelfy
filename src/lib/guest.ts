// Guest mode: lets people use Shelfy without an account.
// Data is persisted to localStorage on the device under a guest user id.
// Signing out of guest mode clears the local data; signing in as a real user
// keeps everything stored in the cloud per their Supabase user id.

const FLAG_KEY = "shelfy:guest";
const ID_KEY = "shelfy:guest:id";
const ITEMS_KEY = "shelfy:guest:items";
const LEGACY_DEMO_NAMES = new Set([
  "Whole Milk",
  "Chicken Breast",
  "Baby Spinach",
  "Free-range Eggs",
  "Greek Yogurt",
  "Salmon Fillet",
  "Sourdough Bread",
  "Mature Cheddar",
  "Baby Carrots",
  "Leftover Pasta",
  "Orange Juice",
  "Salted Butter",
]);

export type GuestItem = {
  id: string;
  user_id: string;
  name: string;
  brand?: string | null;
  category: string;
  location: string;
  expiry_date: string | null;
  price: number | null;
  status: string;
  notes?: string | null;
  is_pantry_staple?: boolean;
  include_in_recipes?: boolean;
  opened_at?: string | null;
  created_at: string;
  updated_at: string;
};

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "g-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function isGuest(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(FLAG_KEY) === "1";
}

export function getGuestId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function startGuest(): string {
  localStorage.setItem(FLAG_KEY, "1");
  clearLegacyGuestDemo();
  const id = getGuestId();
  seedGuestPreview(id);
  return id;
}

function dPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function seedGuestPreview(userId: string) {
  if (readGuestItems().length > 0) return;
  const now = new Date().toISOString();
  const make = (
    name: string,
    category: string,
    location: string,
    days: number | null,
    price: number,
    extras: Partial<GuestItem> = {},
  ): GuestItem => ({
    id: uuid(),
    user_id: userId,
    name,
    category,
    location,
    expiry_date: days === null ? null : dPlus(days),
    price,
    status: "active",
    is_pantry_staple: false,
    include_in_recipes: true,
    opened_at: null,
    created_at: now,
    updated_at: now,
    ...extras,
  });
  const items: GuestItem[] = [
    // Use First (urgent ≤ 2 days)
    make("Whole Milk", "Dairy", "fridge", 1, 1.85),
    make("Baby Spinach", "Vegetables", "fridge", 2, 1.5),
    make("Salmon Fillet", "Fish", "fridge", 0, 5.5),
    // Fridge (warn / fresh)
    make("Greek Yogurt", "Dairy", "fridge", 5, 2.2),
    make("Mature Cheddar", "Dairy", "fridge", 12, 3.4),
    make("Free-range Eggs", "Eggs", "fridge", 9, 2.1),
    make("Orange Juice", "Drinks", "fridge", 4, 2.0),
    // Freezer
    make("Chicken Breast", "Meat", "freezer", 60, 6.0),
    make("Mixed Berries", "Fruit", "freezer", 90, 3.5),
    make("Garlic Naan", "Bakery", "freezer", 45, 2.5),
    // Cupboard
    make("Sourdough Bread", "Bakery", "cupboard", 3, 2.8),
    make("Penne Pasta", "Dry Goods", "cupboard", 200, 1.2),
    make("Chopped Tomatoes", "Tinned", "cupboard", 365, 0.65),
    // Pantry staples
    make("Olive Oil", "Oils", "cupboard", null, 5.5, { is_pantry_staple: true }),
    make("Sea Salt", "Seasonings", "cupboard", null, 1.8, { is_pantry_staple: true }),
    make("Black Pepper", "Seasonings", "cupboard", null, 2.0, { is_pantry_staple: true }),
  ];
  writeGuestItems(items);
}

export function endGuest() {
  localStorage.removeItem(FLAG_KEY);
  localStorage.removeItem(ITEMS_KEY);
  localStorage.removeItem(ID_KEY);
}

export function pauseGuest() {
  localStorage.removeItem(FLAG_KEY);
}

export function readGuestItems(): GuestItem[] {
  try {
    return JSON.parse(localStorage.getItem(ITEMS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function writeGuestItems(items: GuestItem[]) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

export function clearLegacyGuestDemo() {
  const items = readGuestItems();
  const isLegacyDemo =
    items.length === LEGACY_DEMO_NAMES.size && items.every((item) => LEGACY_DEMO_NAMES.has(item.name));

  if (isLegacyDemo) {
    localStorage.removeItem(ITEMS_KEY);
  }
}

export function guestUser() {
  return {
    id: getGuestId(),
    email: "guest@shelfy.local",
    user_metadata: { guest: true },
  };
}
