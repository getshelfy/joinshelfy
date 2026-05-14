import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { ChevronLeft, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { daysUntil } from "@/lib/food";
import {
  ItemRow,
  locationEmoji,
  locationLabel,
  usePantryActions,
  usePantryData,
} from "@/components/pantry-shared";

const VALID = ["fridge", "freezer", "cupboard", "use-first"] as const;
type LocKey = (typeof VALID)[number];

export const Route = createFileRoute("/location/$location")({
  beforeLoad: ({ params }) => {
    if (!VALID.includes(params.location as LocKey)) throw notFound();
  },
  component: LocationPage,
});

function LocationPage() {
  return (
    <AppShell>
      <LocationView />
    </AppShell>
  );
}

function LocationView() {
  const { location } = useParams({ from: "/location/$location" }) as { location: LocKey };
  const { items, setItems, setStaples, loading } = usePantryData();
  const { markStatus, setOpenTarget, dialog } = usePantryActions(setItems, setStaples);

  const filtered =
    location === "use-first"
      ? items.filter((i) => i.expiry_date && daysUntil(i.expiry_date) <= 2)
      : items.filter((i) => i.location === location);

  const sorted = [...filtered].sort((a, b) =>
    (a.expiry_date || "").localeCompare(b.expiry_date || ""),
  );

  const emoji = location === "use-first" ? "🔴" : locationEmoji(location);
  const title = location === "use-first" ? "Use First" : locationLabel(location);
  const subtitle =
    location === "use-first"
      ? "Items expiring in the next 2 days"
      : `${sorted.length} ${sorted.length === 1 ? "item" : "items"}`;

  return (
    <>
      <header className="px-5 pt-7 pb-4">
        <Link
          to="/"
          aria-label="Back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-card-soft text-foreground hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card-soft text-2xl">
            {emoji}
          </div>
          <div>
            <h1 className="font-serif text-3xl font-semibold leading-tight">{title}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="mx-5 mt-6 rounded-3xl border bg-card p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {location === "use-first"
              ? "Nothing urgent right now. Nice work!"
              : "No items here yet."}
          </p>
        </div>
      ) : (
        <ul className="mt-2 space-y-2 px-5">
          {sorted.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onOpen={setOpenTarget}
              onStatus={markStatus}
              showLocation={location === "use-first"}
            />
          ))}
        </ul>
      )}

      {dialog}
    </>
  );
}
