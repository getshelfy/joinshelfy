import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/header";
import { daysUntil, urgencyLabel, urgencyOf } from "@/lib/food";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, Sprout, ChevronDown, AlertCircle } from "lucide-react";
import {
  ItemRow,
  Stat,
  StaplesList,
  locationEmoji,
  locationLabel,
  usePantryActions,
  usePantryData,
  type Item,
} from "@/components/pantry-shared";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <AppShell>
      <Home />
    </AppShell>
  );
}

function Home() {
  const { items, setItems, staples, setStaples, loading, avoidedTotal } = usePantryData();
  const { markStatus, setOpenTarget, dialog } = usePantryActions(setItems, setStaples);

  const expiringSoon = items.filter((i) => i.expiry_date && daysUntil(i.expiry_date) <= 2).length;
  const total = items.length;
  const useFirst = items
    .filter((i) => i.expiry_date && daysUntil(i.expiry_date) <= 2)
    .sort((a, b) => (daysUntil(a.expiry_date!) - daysUntil(b.expiry_date!)));

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
        <>
          {useFirst.length > 0 && (
            <UseFirstBanner items={useFirst} onOpen={setOpenTarget} onStatus={markStatus} />
          )}

          <div className="mt-4 space-y-3 px-5">
            {(["fridge", "freezer", "cupboard"] as const).map((loc) => {
              const locItems = items
                .filter((i) => i.location === loc)
                .sort((a, b) => (a.expiry_date || "").localeCompare(b.expiry_date || ""));
              if (!locItems.length) return null;
              return (
                <LocationCard
                  key={loc}
                  location={loc}
                  items={locItems}
                  onOpen={setOpenTarget}
                  onStatus={markStatus}
                />
              );
            })}
          </div>
        </>
      )}

      <StaplesList staples={staples} onMarkUsed={(id) => markStatus(id, "used")} />

      {dialog}
    </>
  );
}

function UseFirstBanner({
  items,
  onOpen,
  onStatus,
}: {
  items: Item[];
  onOpen: (i: Item) => void;
  onStatus: (id: string, status: "used" | "wasted") => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="mt-5 px-5">
      <div className="overflow-hidden rounded-2xl border border-urgent-foreground/30 bg-urgent/40">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-urgent-foreground" />
            <h2 className="font-serif text-lg text-urgent-foreground">
              Use First <span aria-hidden>🔴</span>
              <span className="ml-1 text-sm font-sans opacity-80">
                · {items.length} {items.length === 1 ? "item" : "items"}
              </span>
            </h2>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-urgent-foreground transition-transform duration-200",
              !open && "-rotate-90",
            )}
          />
        </button>
        {open && (
          <ul className="space-y-2 px-3 pb-3">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onOpen={onOpen}
                onStatus={onStatus}
                showLocation
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function LocationCard({
  location,
  items,
  onOpen,
  onStatus,
}: {
  location: "fridge" | "freezer" | "cupboard";
  items: Item[];
  onOpen: (i: Item) => void;
  onStatus: (id: string, status: "used" | "wasted") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const preview = items.slice(0, 3);
  const urgentCount = items.filter((i) => i.expiry_date && daysUntil(i.expiry_date) <= 2).length;

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
        aria-expanded={expanded}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card-soft text-2xl">
          {locationEmoji(location)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-serif text-lg leading-tight">{locationLabel(location)}</h2>
            <span className="text-xs text-muted-foreground">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 overflow-hidden">
            {urgentCount > 0 && (
              <span className="shrink-0 rounded-full bg-urgent px-2 py-0.5 text-[11px] font-medium text-urgent-foreground">
                {urgentCount} urgent
              </span>
            )}
            <p className="truncate text-xs text-muted-foreground">
              {preview.map((p) => p.name).join(" · ")}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            !expanded && "-rotate-90",
          )}
        />
      </button>

      {expanded && (
        <ul className="space-y-2 border-t bg-card-soft/40 p-3">
          {items.map((item) => {
            const days = item.expiry_date ? daysUntil(item.expiry_date) : 999;
            const u = urgencyOf(days);
            // accent border by urgency
            const accent =
              u === "urgent"
                ? "border-l-urgent-foreground"
                : u === "warn"
                  ? "border-l-warn-foreground"
                  : "border-l-fresh-foreground";
            return (
              <div key={item.id} className={cn("rounded-2xl border-l-4 bg-card", accent)}>
                <ItemRow
                  item={item}
                  onOpen={onOpen}
                  onStatus={onStatus}
                  showLocation={false}
                />
              </div>
            );
          })}
          <p className="px-1 pt-1 text-[11px] text-muted-foreground">
            Sorted by urgency · {urgencyLabel(items[0].expiry_date ? daysUntil(items[0].expiry_date) : 999)} on top
          </p>
        </ul>
      )}
    </section>
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
