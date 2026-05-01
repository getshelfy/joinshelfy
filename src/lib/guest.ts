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
  expiry_date: string;
  price: number | null;
  status: string;
  notes?: string | null;
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
  return getGuestId();
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
