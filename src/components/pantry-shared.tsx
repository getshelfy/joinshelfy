import { useEffect, useState } from "react";
import { Check, Trash2, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listActiveItems,
  listPantryStaples,
  markItemOpened,
  updateItemStatus,
  sumUsedSince,
  type FoodRow,
} from "@/lib/db";
import { categoryEmoji, daysUntil, urgencyLabel, urgencyOf } from "@/lib/food";
import { tap, tapLight, tapSelect, tapSuccess, tapWarn } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export type Item = FoodRow;

export function locationEmoji(loc: string) {
  if (loc === "fridge") return "🧊";
  if (loc === "freezer") return "❄️";
  if (loc === "cupboard") return "🗄️";
  return "📦";
}

export function locationLabel(loc: string) {
  return loc.charAt(0).toUpperCase() + loc.slice(1).toLowerCase();
}

export function usePantryData() {
  const [items, setItems] = useState<Item[]>([]);
  const [staples, setStaples] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [avoidedTotal, setAvoidedTotal] = useState(0);

  const load = async () => {
    try {
      const [data, st] = await Promise.all([listActiveItems(), listPantryStaples()]);
      setItems(data);
      setStaples(st);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    sumUsedSince(since).then(setAvoidedTotal).catch(() => setAvoidedTotal(0));
  }, [items.length]);

  return { items, setItems, staples, setStaples, loading, avoidedTotal };
}

export function usePantryActions(
  setItems: React.Dispatch<React.SetStateAction<Item[]>>,
  setStaples: React.Dispatch<React.SetStateAction<Item[]>>,
) {
  const [openTarget, setOpenTarget] = useState<Item | null>(null);
  const [customDays, setCustomDays] = useState("");
  const [opening, setOpening] = useState(false);

  const markStatus = async (id: string, status: "used" | "wasted") => {
    if (status === "used") tapSuccess();
    else tapWarn();
    try {
      await updateItemStatus(id, status);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setStaples((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // ignore
    }
  };

  const confirmOpened = async (days: number) => {
    if (!openTarget || !Number.isFinite(days) || days < 1) return;
    setOpening(true);
    tapSelect();
    try {
      const newExpiry = await markItemOpened(openTarget.id, Math.round(days));
      const openedAt = new Date().toISOString();
      const update = (i: Item) =>
        i.id === openTarget.id ? { ...i, expiry_date: newExpiry, opened_at: openedAt } : i;
      setItems((prev) => prev.map(update));
      setStaples((prev) => prev.map(update));
      setOpenTarget(null);
      setCustomDays("");
    } finally {
      setOpening(false);
    }
  };

  const dialog = (
    <Dialog
      open={!!openTarget}
      onOpenChange={(o) => {
        if (o) {
          tap();
        } else {
          tapLight();
          setOpenTarget(null);
          setCustomDays("");
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark as opened</DialogTitle>
          <DialogDescription>
            {openTarget?.name ? `Use ${openTarget.name} within how many days?` : "Use within how many days?"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 5, 7].map((d) => (
            <Button
              key={d}
              variant="outline"
              disabled={opening}
              onClick={() => confirmOpened(d)}
              className="h-12 flex-col"
            >
              <span className="text-base font-semibold leading-none">{d}</span>
              <span className="text-[10px] opacity-70">day{d === 1 ? "" : "s"}</span>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            placeholder="Custom days"
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
          />
          <Button
            disabled={opening || !customDays || Number(customDays) < 1}
            onClick={() => confirmOpened(Number(customDays))}
          >
            Set
          </Button>
        </div>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );

  return { markStatus, setOpenTarget, dialog };
}

export function ItemRow({
  item,
  onOpen,
  onStatus,
  showLocation = true,
}: {
  item: Item;
  onOpen: (i: Item) => void;
  onStatus: (id: string, status: "used" | "wasted") => void;
  showLocation?: boolean;
}) {
  const days = item.expiry_date ? daysUntil(item.expiry_date) : 999;
  const u = urgencyOf(days);
  const tone =
    u === "urgent"
      ? "bg-urgent text-urgent-foreground"
      : u === "warn"
        ? "bg-warn text-warn-foreground"
        : "bg-fresh text-fresh-foreground";
  return (
    <li
      className={cn(
        "rounded-2xl border bg-card p-3.5 shadow-sm transition-all duration-200",
        u === "urgent" && "border-urgent-foreground/20",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card-soft text-2xl">
          {categoryEmoji(item.category)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">{item.name}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", tone)}>
              {urgencyLabel(days)}
            </span>
            {showLocation && (
              <span className="inline-flex items-center gap-1 rounded-full bg-card-soft px-2 py-0.5 capitalize">
                <span aria-hidden>{locationEmoji(item.location)}</span>
                {item.location}
              </span>
            )}
            {item.opened_at && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
                <PackageOpen className="h-3 w-3" /> Opened
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!item.opened_at && (
            <button
              onClick={() => {
                tap();
                onOpen(item);
              }}
              aria-label="Mark opened"
              className="tactile flex h-9 w-9 items-center justify-center rounded-full bg-card-soft text-foreground hover:bg-muted"
            >
              <PackageOpen className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onStatus(item.id, "used")}
            aria-label="Mark used"
            className="tactile flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => onStatus(item.id, "wasted")}
            aria-label="Mark wasted"
            className="tactile flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

export function StaplesList({
  staples,
  onMarkUsed,
}: {
  staples: Item[];
  onMarkUsed: (id: string) => void;
}) {
  if (!staples.length) return null;
  return (
    <section className="mt-8 px-5 pb-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-lg">Pantry staples</h2>
        <span className="text-xs text-muted-foreground">No expiry tracking</span>
      </div>
      <ul className="mt-2 space-y-2">
        {staples.map((item) => (
          <li key={item.id} className="rounded-2xl border bg-card-soft p-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-xl">
              {categoryEmoji(item.category)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="truncate font-medium text-sm">{item.name}</h3>
              <p className="text-xs text-muted-foreground">Used in recipes</p>
            </div>
            <button
              onClick={() => onMarkUsed(item.id)}
              aria-label="Ran out"
              className="text-xs px-2.5 py-1 rounded-full bg-card hover:bg-muted"
            >
              Ran out
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Stat({
  value,
  label,
  tone,
}: {
  value: React.ReactNode;
  label: string;
  tone: "urgent" | "fresh" | "neutral";
}) {
  const toneCls =
    tone === "urgent"
      ? "bg-urgent text-urgent-foreground"
      : tone === "fresh"
        ? "bg-fresh text-fresh-foreground"
        : "bg-card-soft text-foreground";
  return (
    <div className={cn("rounded-2xl p-3", toneCls)}>
      <div className="font-serif text-2xl font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[11px] leading-tight opacity-80">{label}</div>
    </div>
  );
}
