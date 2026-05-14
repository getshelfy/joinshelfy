import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/header";
import { daysUntil } from "@/lib/food";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, Sprout, ChevronRight } from "lucide-react";
import {
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
  const { markStatus } = usePantryActions(setItems, setStaples);

  const urgent = items.filter((i) => i.expiry_date && daysUntil(i.expiry_date) <= 2);
  const total = items.length;

  return (
    <>
      <Header title="Your pantry" subtitle="Use it up to avoid waste" />

      <section className="grid grid-cols-3 gap-2 px-5">
        <Stat value={urgent.length} label="Expiring soon" tone="urgent" />
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
        <div className="mt-5 grid grid-cols-2 gap-3 px-5">
          <LocationCard
            to="use-first"
            emoji="🔴"
            title="Use First"
            items={urgent}
            tone="urgent"
            preview="Items expiring in 2 days"
          />
          {(["fridge", "freezer", "cupboard"] as const).map((loc) => {
            const locItems = items.filter((i) => i.location === loc);
            const locUrgent = locItems.filter(
              (i) => i.expiry_date && daysUntil(i.expiry_date) <= 2,
            ).length;
            return (
              <LocationCard
                key={loc}
                to={loc}
                emoji={locationEmoji(loc)}
                title={locationLabel(loc)}
                items={locItems}
                urgentCount={locUrgent}
                preview={
                  locItems
                    .slice()
                    .sort((a, b) => (a.expiry_date || "").localeCompare(b.expiry_date || ""))
                    .slice(0, 3)
                    .map((p) => p.name)
                    .join(" · ") || "Empty"
                }
              />
            );
          })}
        </div>
      )}

      <StaplesList staples={staples} onMarkUsed={(id) => markStatus(id, "used")} />
    </>
  );
}

function LocationCard({
  to,
  emoji,
  title,
  items,
  urgentCount,
  tone,
  preview,
}: {
  to: string;
  emoji: string;
  title: string;
  items: Item[];
  urgentCount?: number;
  tone?: "urgent";
  preview: string;
}) {
  const count = items.length;
  const showBadge = tone === "urgent" ? count > 0 : (urgentCount ?? 0) > 0;
  const badgeCount = tone === "urgent" ? count : (urgentCount ?? 0);

  return (
    <Link
      to="/location/$location"
      params={{ location: to }}
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-card p-4 shadow-sm transition-all",
        "active:scale-[0.97] active:shadow-none hover:bg-muted/40",
        tone === "urgent" && "border-urgent-foreground/30 bg-urgent/30",
      )}
    >
      <div
        className={cn(
          "relative flex h-12 w-12 items-center justify-center rounded-2xl text-2xl",
          tone === "urgent" ? "bg-card" : "bg-card-soft",
        )}
      >
        {emoji}
        {showBadge && tone !== "urgent" && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-urgent px-1 text-[10px] font-semibold text-urgent-foreground ring-2 ring-card">
            {badgeCount}
          </span>
        )}
      </div>
      <h2 className="mt-3 font-serif text-base leading-tight">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {count} {count === 1 ? "item" : "items"}
      </p>
      <ChevronRight className="absolute right-3 top-3 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
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
