import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/header";
import {
  listActiveItems,
  listPantryStaples,
  sumUsedSince,
  updateItemStatus,
  markItemOpened,
  type FoodRow,
} from "@/lib/db";
import { categoryEmoji, daysUntil, urgencyLabel, urgencyOf } from "@/lib/food";
import { cn } from "@/lib/utils";
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
import { Plus, Check, Trash2, Sprout, PackageOpen, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/")({
  component: PantryPage,
});

type Item = FoodRow;

function locationEmoji(loc: string) {
  if (loc === "freezer") return "🧊";
  if (loc === "cupboard") return "🪵";
  return "❄️";
}

function PantryPage() {
  return (
    <AppShell>
      <Pantry />
    </AppShell>
  );
}

function Pantry() {
  const [items, setItems] = useState<Item[]>([]);
  const [staples, setStaples] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [data, st] = await Promise.all([listActiveItems(), listPantryStaples()]);
      setItems(data);
      setStaples(st);
    } catch (err: any) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const [openTarget, setOpenTarget] = useState<Item | null>(null);
  const [customDays, setCustomDays] = useState("");
  const [opening, setOpening] = useState(false);

  const markStatus = async (id: string, status: "used" | "wasted") => {
    try {
      await updateItemStatus(id, status);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setStaples((prev) => prev.filter((i) => i.id !== id));
    } catch (err: any) {
    }
  };

  const confirmOpened = async (days: number) => {
    if (!openTarget || !Number.isFinite(days) || days < 1) return;
    setOpening(true);
    try {
      const newExpiry = await markItemOpened(openTarget.id, Math.round(days));
      const openedAt = new Date().toISOString();
      const update = (i: Item) =>
        i.id === openTarget.id ? { ...i, expiry_date: newExpiry, opened_at: openedAt } : i;
      setItems((prev) => prev.map(update));
      setStaples((prev) => prev.map(update));
      setOpenTarget(null);
      setCustomDays("");
    } catch (err: any) {
    } finally {
      setOpening(false);
    }
  };

  const expiringSoon = items.filter((i) => i.expiry_date && daysUntil(i.expiry_date) <= 2).length;
  const total = items.length;
  const [avoidedTotal, setAvoidedTotal] = useState(0);
  useEffect(() => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    sumUsedSince(since).then(setAvoidedTotal).catch(() => setAvoidedTotal(0));
  }, [items.length]);

  return (
    <>
      <Header title="Your pantry" subtitle="Use it up to avoid waste" />

      <section className="grid grid-cols-3 gap-2 px-5">
        <Stat value={expiringSoon} label="Expiring soon" tone="urgent" />
        <Stat value={total} label="Items tracked" tone="neutral" />
        <Stat value={`£${avoidedTotal.toFixed(0)}`} label="Waste avoided (30d)" tone="fresh" />
      </section>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <GroupedSections
          items={items}
          onOpen={(i) => setOpenTarget(i)}
          onStatus={markStatus}
        />
      )}

      {staples.length > 0 && (
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
                  onClick={() => markStatus(item.id, "used")}
                  aria-label="Ran out"
                  className="text-xs px-2.5 py-1 rounded-full bg-card hover:bg-muted"
                >
                  Ran out
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog
        open={!!openTarget}
        onOpenChange={(o) => {
          if (!o) {
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
    </>
  );
}

function Stat({ value, label, tone }: { value: React.ReactNode; label: string; tone: "urgent" | "fresh" | "neutral" }) {
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

function EmptyState() {
  return (
    <div className="mx-5 mt-10 rounded-3xl border bg-card p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sprout className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-serif text-xl">Your shelf is empty</h2>
      <p className="mt-1 text-sm text-muted-foreground">Add your first item and we'll track when it expires.</p>
      <Button asChild className="mt-5 h-11">
        <Link to="/add">
          <Plus className="mr-1 h-4 w-4" /> Add an item
        </Link>
      </Button>
    </div>
  );
}
