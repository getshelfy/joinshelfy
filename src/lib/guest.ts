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
  if (readGuestItems().length === 0) {
    seedGuestPreview(id);
  }
  return id;
}

function dPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function seedGuestPreview(uid: string) {
  const t = new Date().toISOString();
  const seed: Array<Partial<GuestItem> & { name: string; category: string; location: string; expiry_date: string | null; price: number; is_pantry_staple?: boolean }> = [
    // Use First (≤2 days)
    { name: "Whole Milk", category: "Dairy", location: "fridge", expiry_date: dPlus(1), price: 1.4 },
    { name: "Baby Spinach", category: "Vegetables", location: "fridge", expiry_date: dPlus(0), price: 1.8 },
    { name: "Chicken Breast", category: "Meat", location: "fridge", expiry_date: dPlus(2), price: 5.5 },
    // Fridge
    { name: "Free-range Eggs", category: "Dairy", location: "fridge", expiry_date: dPlus(4), price: 2.6 },
    { name: "Greek Yogurt", category: "Dairy", location: "fridge", expiry_date: dPlus(3), price: 2.2 },
    { name: "Salmon Fillet", category: "Fish", location: "fridge", expiry_date: dPlus(3), price: 6.0 },
    { name: "Mature Cheddar", category: "Dairy", location: "fridge", expiry_date: dPlus(14), price: 3.8 },
    { name: "Leftover Pasta", category: "Leftovers", location: "fridge", expiry_date: dPlus(2), price: 2.0 },
    // Freezer
    { name: "Frozen Peas", category: "Vegetables", location: "freezer", expiry_date: dPlus(60), price: 1.5 },
    { name: "Frozen Berries", category: "Fruit", location: "freezer", expiry_date: dPlus(45), price: 3.2 },
    { name: "Beef Mince", category: "Meat", location: "freezer", expiry_date: dPlus(30), price: 4.5 },
    { name: "Fish Fingers", category: "Fish", location: "freezer", expiry_date: dPlus(90), price: 3.0 },
    // Cupboard
    { name: "Sourdough Bread", category: "Grains", location: "cupboard", expiry_date: dPlus(5), price: 3.2 },
    { name: "Tortilla Wraps", category: "Grains", location: "cupboard", expiry_date: dPlus(8), price: 2.1 },
    { name: "Pasta", category: "Grains", location: "cupboard", expiry_date: dPlus(300), price: 1.2, is_pantry_staple: true },
    { name: "Olive Oil", category: "Pantry", location: "cupboard", expiry_date: dPlus(365), price: 6.5, is_pantry_staple: true },
    { name: "Canned Tomatoes", category: "Pantry", location: "cupboard", expiry_date: dPlus(400), price: 0.9, is_pantry_staple: true },
  ];
  const items: GuestItem[] = seed.map((s) => ({
    id: uuid(),
    user_id: uid,
    name: s.name,
    brand: null,
    category: s.category,
    location: s.location,
    expiry_date: s.expiry_date,
    price: s.price,
    status: "active",
    notes: null,
    is_pantry_staple: s.is_pantry_staple ?? false,
    include_in_recipes: true,
    opened_at: null,
    created_at: t,
    updated_at: t,
  }));
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
