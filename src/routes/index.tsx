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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

type GroupedProps = {
  items: Item[];
  onOpen: (i: Item) => void;
  onStatus: (id: string, status: "used" | "wasted") => void;
};

function GroupedSections({ items, onOpen, onStatus }: GroupedProps) {
  const useFirst = items.filter(
    (i) => i.expiry_date && daysUntil(i.expiry_date) <= 2,
  );
  const fridge = items.filter((i) => i.location === "fridge");
  const freezer = items.filter((i) => i.location === "freezer");
  const cupboard = items.filter((i) => i.location === "cupboard");

  return (
    <div className="mt-6 space-y-4 px-5">
      {useFirst.length > 0 && (
        <Section
          id="use-first"
          title="Use First"
          emoji="🔴"
          count={useFirst.length}
          items={useFirst}
          collapsible={false}
          onOpen={onOpen}
          onStatus={onStatus}
        />
      )}
      {fridge.length > 0 && (
        <Section id="fridge" title="Fridge" emoji="🧊" count={fridge.length} items={fridge} onOpen={onOpen} onStatus={onStatus} />
      )}
      {freezer.length > 0 && (
        <Section id="freezer" title="Freezer" emoji="❄️" count={freezer.length} items={freezer} onOpen={onOpen} onStatus={onStatus} />
      )}
      {cupboard.length > 0 && (
        <Section id="cupboard" title="Cupboard" emoji="🗄️" count={cupboard.length} items={cupboard} onOpen={onOpen} onStatus={onStatus} />
      )}
    </div>
  );
}

function Section({
  id,
  title,
  emoji,
  count,
  items,
  collapsible = true,
  onOpen,
  onStatus,
}: {
  id: string;
  title: string;
  emoji: string;
  count: number;
  items: Item[];
  collapsible?: boolean;
  onOpen: (i: Item) => void;
  onStatus: (id: string, status: "used" | "wasted") => void;
}) {
  const [open, setOpen] = useState(true);
  const expanded = !collapsible || open;
  const HeaderTag = collapsible ? "button" : "div";
  return (
    <section>
      <HeaderTag
        {...(collapsible
          ? {
              type: "button" as const,
              onClick: () => setOpen((o) => !o),
              "aria-expanded": expanded,
              "aria-controls": `section-${id}`,
            }
          : {})}
        className={cn(
          "flex w-full items-center justify-between rounded-xl px-1 py-1.5 text-left",
          collapsible && "hover:bg-muted/50",
        )}
      >
        <h2 className="font-serif text-lg">
          {title} <span aria-hidden>{emoji}</span>{" "}
          <span className="text-sm font-sans text-muted-foreground">
            · {count} {count === 1 ? "item" : "items"}
          </span>
        </h2>
        {collapsible && (
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              !expanded && "-rotate-90",
            )}
          />
        )}
      </HeaderTag>
      {expanded && (
        <ul id={`section-${id}`} className="mt-2 space-y-2.5">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} onOpen={onOpen} onStatus={onStatus} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemRow({
  item,
  onOpen,
  onStatus,
}: {
  item: Item;
  onOpen: (i: Item) => void;
  onStatus: (id: string, status: "used" | "wasted") => void;
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
        "rounded-2xl border bg-card p-3.5 shadow-sm transition-all",
        u === "urgent" && "border-urgent-foreground/20",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card-soft text-2xl">
          {categoryEmoji(item.category)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate font-medium">{item.name}</h3>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", tone)}>
              {urgencyLabel(days)}
            </span>
            <span className="inline-flex items-center gap-1 capitalize">
              <span aria-hidden>{locationEmoji(item.location)}</span>
              {item.location}
            </span>
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
              onClick={() => onOpen(item)}
              aria-label="Mark opened"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-card-soft text-foreground hover:bg-muted"
            >
              <PackageOpen className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onStatus(item.id, "used")}
            aria-label="Mark used"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => onStatus(item.id, "wasted")}
            aria-label="Mark wasted"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
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
