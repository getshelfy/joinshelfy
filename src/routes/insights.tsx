import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/header";
import { supabase } from "@/integrations/supabase/client";
import { categoryEmoji } from "@/lib/food";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from "recharts";

export const Route = createFileRoute("/insights")({
  component: () => (
    <AppShell>
      <InsightsPage />
    </AppShell>
  ),
});

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function InsightsPage() {
  const [moneySaved, setMoneySaved] = useState(0);
  const [weekly, setWeekly] = useState<Array<{ week: string; used: number; wasted: number }>>([]);
  const [byCategory, setByCategory] = useState<Array<{ category: string; wasted: number }>>([]);
  const [usedCount, setUsedCount] = useState(0);
  const [wastedCount, setWastedCount] = useState(0);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase
        .from("food_items")
        .select("category,price,status,updated_at")
        .in("status", ["used", "wasted"])
        .gte("updated_at", since);
      const rows = data || [];
      const saved = rows.filter((r: any) => r.status === "used").reduce((s, r: any) => s + Number(r.price || 0), 0);
      setMoneySaved(saved);
      setUsedCount(rows.filter((r: any) => r.status === "used").length);
      setWastedCount(rows.filter((r: any) => r.status === "wasted").length);

      // Weekly buckets — last 4 weeks
      const buckets: Record<string, { used: number; wasted: number }> = {};
      for (let i = 3; i >= 0; i--) {
        const d = startOfWeek(new Date(Date.now() - i * 7 * 86400000));
        const key = `${d.getMonth() + 1}/${d.getDate()}`;
        buckets[key] = { used: 0, wasted: 0 };
      }
      rows.forEach((r: any) => {
        const wk = startOfWeek(new Date(r.updated_at));
        const key = `${wk.getMonth() + 1}/${wk.getDate()}`;
        if (buckets[key]) buckets[key][r.status as "used" | "wasted"]++;
      });
      setWeekly(Object.entries(buckets).map(([week, v]) => ({ week, ...v })));

      // Category breakdown of wasted
      const cat: Record<string, number> = {};
      rows.filter((r: any) => r.status === "wasted").forEach((r: any) => {
        cat[r.category] = (cat[r.category] || 0) + 1;
      });
      setByCategory(
        Object.entries(cat)
          .map(([category, wasted]) => ({ category, wasted }))
          .sort((a, b) => b.wasted - a.wasted)
          .slice(0, 5),
      );
    })();
  }, []);

  const total = usedCount + wastedCount;
  const successRate = total > 0 ? Math.round((usedCount / total) * 100) : 0;
  const message =
    total === 0
      ? "Tick items off as you use them to start tracking your wins."
      : successRate >= 80
        ? `Brilliant — ${successRate}% of your food got eaten. Keep it up! 🌱`
        : successRate >= 50
          ? `Solid month. ${successRate}% used — let's nudge that higher.`
          : `Every bit helps. Try recipes for items expiring soonest.`;

  return (
    <>
      <Header title="Your wins" subtitle="The food you saved, in numbers." />

      <section className="px-5">
        <div className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-md">
          <p className="text-xs uppercase tracking-wide opacity-80">Saved this month</p>
          <p className="mt-1 font-serif text-4xl font-semibold">£{moneySaved.toFixed(2)}</p>
          <p className="mt-2 text-sm opacity-90">{message}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-fresh p-3 text-fresh-foreground">
            <div className="font-serif text-2xl font-semibold">{usedCount}</div>
            <div className="text-[11px] opacity-80">Items used up</div>
          </div>
          <div className="rounded-2xl bg-urgent p-3 text-urgent-foreground">
            <div className="font-serif text-2xl font-semibold">{wastedCount}</div>
            <div className="text-[11px] opacity-80">Items wasted</div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg">Last 4 weeks</h2>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> Used
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-destructive" /> Wasted
              </span>
            </div>
          </div>
          <div className="mt-3 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} barGap={4} barCategoryGap="22%" margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.6 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.6 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: "currentColor", fillOpacity: 0.04 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    fontSize: 12,
                    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                  }}
                />
                <Bar dataKey="used" fill="var(--color-primary)" radius={[8, 8, 0, 0]} maxBarSize={22} />
                <Bar dataKey="wasted" fill="var(--color-destructive)" radius={[8, 8, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border bg-card p-4">
          <h2 className="font-serif text-lg">Most wasted</h2>
          {byCategory.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No waste logged yet — nice work!</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {byCategory.map((c) => {
                const max = byCategory[0].wasted || 1;
                const pct = (c.wasted / max) * 100;
                return (
                  <li key={c.category}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{categoryEmoji(c.category)} {c.category}</span>
                      <span className="text-muted-foreground">{c.wasted}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-destructive/70" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
