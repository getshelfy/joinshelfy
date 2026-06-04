import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Sprout } from "lucide-react";
import { daysUntil } from "@/lib/food";
import {
  ItemRow,
  StaplesList,
  usePantryActions,
  usePantryData,
  type Item,
} from "@/components/pantry-shared";

export const Route = createFileRoute("/pantry")({
  component: () => (
    <AppShell>
      <PantryView />
    </AppShell>
  ),
});

function PantryView() {
  const { items, setItems, staples, setStaples, loading } = usePantryData();
  const { markStatus, setOpenTarget, dialog } = usePantryActions(setItems, setStaples);
  const [query, setQuery] = useState("");

  const { expired, urgent, warn, fresh } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
    const sorted = [...filtered].sort((a, b) => {
      const da = a.expiry_date ? daysUntil(a.expiry_date) : 999;
      const db = b.expiry_date ? daysUntil(b.expiry_date) : 999;
      return da - db;
    });
    const e: Item[] = [];
    const u: Item[] = [];
    const w: Item[] = [];
    const f: Item[] = [];
    for (const it of sorted) {
      const d = it.expiry_date ? daysUntil(it.expiry_date) : 999;
      if (d < 0) e.push(it);
      else if (d <= 2) u.push(it);
      else if (d <= 5) w.push(it);
      else f.push(it);
    }
    return { expired: e, urgent: u, warn: w, fresh: f };
  }, [items, query]);

  return (
    <>
      <Header title="All items" subtitle="Sorted by urgency" />

      <div className="px-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="mx-5 mt-10 rounded-3xl border bg-card p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sprout className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-serif text-xl">Your shelf is empty</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first item and we'll track when it expires.
          </p>
          <Button asChild className="mt-5 h-11">
            <Link to="/add">
              <Plus className="mr-1 h-4 w-4" /> Add an item
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-5 space-y-5 px-5">
          <UrgencySection
            title="Expiring Soon"
            emoji="🔴"
            tone="urgent"
            items={urgent}
            onOpen={setOpenTarget}
            onStatus={markStatus}
          />
          <UrgencySection
            title="Coming Up"
            emoji="🟡"
            tone="warn"
            items={warn}
            onOpen={setOpenTarget}
            onStatus={markStatus}
          />
          <UrgencySection
            title="All Good"
            emoji="🟢"
            tone="fresh"
            items={fresh}
            onOpen={setOpenTarget}
            onStatus={markStatus}
          />
          <ExpiredSection items={expired} onStatus={markStatus} />
          {expired.length === 0 && urgent.length === 0 && warn.length === 0 && fresh.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No items match "{query}".
            </p>
          )}
        </div>
      )}

      <StaplesList staples={staples} onMarkUsed={(id) => markStatus(id, "used")} />

      {dialog}
    </>
  );
}

function UrgencySection({
  title,
  emoji,
  tone,
  items,
  onOpen,
  onStatus,
}: {
  title: string;
  emoji: string;
  tone: "urgent" | "warn" | "fresh";
  items: Item[];
  onOpen: (i: Item) => void;
  onStatus: (id: string, status: "used" | "wasted") => void;
}) {
  if (!items.length) return null;
  const dot =
    tone === "urgent"
      ? "bg-urgent-foreground"
      : tone === "warn"
        ? "bg-warn-foreground"
        : "bg-fresh-foreground";
  return (
    <section>
      <div className="flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
        <h2 className="font-serif text-lg">
          {title} <span aria-hidden>{emoji}</span>
          <span className="ml-1 text-sm font-sans text-muted-foreground">
            · {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </h2>
      </div>
      <ul className="mt-2 space-y-2.5">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} onOpen={onOpen} onStatus={onStatus} showLocation />
        ))}
      </ul>
    </section>
  );
}

function ExpiredSection({
  items,
  onStatus,
}: {
  items: Item[];
  onStatus: (id: string, status: "used" | "wasted") => void;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-2">
      <div className="flex items-center gap-2 px-1">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/60" aria-hidden />
        <h2 className="font-serif text-lg">
          Expired
          <span className="ml-1 text-sm font-sans text-muted-foreground">
            · {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </h2>
      </div>
      <p className="mt-1 px-1 text-xs text-muted-foreground">
        These items have passed their date — use your judgement.
      </p>
      <ul className="mt-2 space-y-2.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border bg-card-soft p-3.5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card text-2xl opacity-80">
                {categoryEmoji(item.category)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium">{item.name}</h3>
                <div className="mt-0.5 text-xs text-muted-foreground capitalize">
                  {item.expiry_date ? `Passed ${Math.abs(daysUntil(item.expiry_date))}d ago` : "Past date"}
                  {" · "}
                  {item.location}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                onClick={() => onStatus(item.id, "used")}
                className="h-9 flex-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Mark as used
              </Button>
              <Button
                variant="outline"
                onClick={() => onStatus(item.id, "wasted")}
                className="h-9 flex-1 rounded-full border-border bg-card text-foreground hover:bg-muted"
              >
                Mark as wasted
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
