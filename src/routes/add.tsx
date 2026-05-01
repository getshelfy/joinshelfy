import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIES, LOCATIONS, guessCategory } from "@/lib/food";
import { toast } from "sonner";
import { Camera, Scan, Loader2, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/add")({
  component: () => (
    <AppShell>
      <AddPage />
    </AppShell>
  ),
});

function AddPage() {
  return (
    <>
      <Header title="Add to your pantry" subtitle="Scan, snap, or type — whatever's easiest." />
      <div className="px-5">
        <Tabs defaultValue="single">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Single item</TabsTrigger>
            <TabsTrigger value="bulk">Bulk add</TabsTrigger>
          </TabsList>
          <TabsContent value="single" className="mt-4">
            <SingleAdd />
          </TabsContent>
          <TabsContent value="bulk" className="mt-4">
            <BulkAdd />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

type Step = "barcode" | "details" | "expiry";

function SingleAdd() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("barcode");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("Other");
  const [location, setLocation] = useState<string>("fridge");
  const [price, setPrice] = useState("");
  const [expiry, setExpiry] = useState("");
  const [scanning, setScanning] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [barcode, setBarcode] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Barcode detection via native BarcodeDetector if available
  useEffect(() => {
    if (step !== "barcode" || !scanning) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    (async () => {
      try {
        // @ts-expect-error - non-standard global
        const Detector = (window as any).BarcodeDetector;
        if (!Detector) {
          toast.message("Camera scan not supported here. Enter the barcode or skip.");
          setScanning(false);
          return;
        }
        const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes[0]?.rawValue) {
              setBarcode(codes[0].rawValue);
              setScanning(false);
              await lookup(codes[0].rawValue);
              return;
            }
          } catch {}
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e: any) {
        toast.error("Camera unavailable: " + (e.message || "unknown"));
        setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [step, scanning]);

  const lookup = async (code: string) => {
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      const data = await res.json();
      if (data.status === 1) {
        const p = data.product;
        const n = p.product_name || p.generic_name || "";
        setName(n);
        setBrand(p.brands || "");
        setCategory(guessCategory(n, { categories: p.categories || "" }));
        toast.success(`Found: ${n || "product"}`);
      } else {
        toast.message("Couldn't find that product. Add the name manually.");
      }
    } catch {
      toast.message("Lookup failed. Add the name manually.");
    } finally {
      setStep("details");
    }
  };

  const onExpiryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    try {
      const b64 = await fileToDataUrl(file);
      const { data, error } = await supabase.functions.invoke("scan-expiry", { body: { imageBase64: b64 } });
      if (error) throw error;
      if (data?.date) {
        setExpiry(data.date);
        toast.success(`Detected: ${data.date}`);
      } else {
        toast.message("Couldn't read the date. Pick it manually.");
      }
    } catch (err: any) {
      toast.error(err.message || "OCR failed");
    } finally {
      setOcrLoading(false);
    }
  };

  const save = async () => {
    if (!name || !expiry) {
      toast.error("Name and expiry date are required");
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("food_items").insert({
      user_id: u.user.id,
      name,
      brand: brand || null,
      category,
      location,
      expiry_date: expiry,
      price: price ? Number(price) : 0,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Added to your pantry 🌿");
    navigate({ to: "/" });
  };

  return (
    <div className="space-y-5">
      {step === "barcode" && (
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-serif text-lg">Step 1 — Scan the barcode</h3>
          <p className="mt-1 text-sm text-muted-foreground">We'll auto-fill the product name for you.</p>

          {scanning ? (
            <div className="mt-4 overflow-hidden rounded-xl bg-black aspect-[4/3]">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            </div>
          ) : (
            <button
              onClick={() => setScanning(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-primary-foreground"
            >
              <Scan className="h-5 w-5" /> Open camera
            </button>
          )}

          <div className="mt-4 space-y-2">
            <Label htmlFor="bc">Or enter a barcode</Label>
            <div className="flex gap-2">
              <Input id="bc" inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="e.g. 5000295125247" />
              <Button onClick={() => barcode && lookup(barcode)} variant="secondary">Look up</Button>
            </div>
          </div>

          <button onClick={() => setStep("details")} className="mt-4 w-full rounded-xl border py-3 text-sm">
            Skip — enter manually
          </button>
        </div>
      )}

      {step === "details" && (
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <h3 className="font-serif text-lg">Item details</h3>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Whole milk" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.name} value={c.name}>{c.emoji} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((l) => (
                    <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Price (optional)</Label>
            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="2.50" />
          </div>
          <Button onClick={() => setStep("expiry")} className="w-full h-11" disabled={!name}>Next: expiry date</Button>
        </div>
      )}

      {step === "expiry" && (
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <h3 className="font-serif text-lg">Step 2 — Expiry date</h3>
          <p className="text-sm text-muted-foreground">Snap a photo of the date on the packaging — or pick it below.</p>

          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onExpiryFile} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-primary-foreground disabled:opacity-60"
            disabled={ocrLoading}
          >
            {ocrLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            {ocrLoading ? "Reading date..." : "Snap the expiry date"}
          </button>

          <div className="space-y-2">
            <Label>Expiry date</Label>
            <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>

          <Button onClick={save} className="w-full h-11" disabled={saving || !expiry}>
            {saving ? "Saving..." : "Add to pantry"}
          </Button>
        </div>
      )}
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

type BulkRow = { name: string; category: string; location: string; expiry_date: string; price: string };

function BulkAdd() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BulkRow[]>([
    { name: "", category: "Other", location: "fridge", expiry_date: "", price: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<BulkRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    const valid = rows.filter((r) => r.name && r.expiry_date);
    if (!valid.length) return toast.error("Add at least one row with a name and date");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload = valid.map((r) => ({
      user_id: u.user!.id,
      name: r.name,
      category: r.category,
      location: r.location,
      expiry_date: r.expiry_date,
      price: r.price ? Number(r.price) : 0,
    }));
    const { error } = await supabase.from("food_items").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Added ${valid.length} items`);
    navigate({ to: "/" });
  };

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="rounded-2xl border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Item name"
              value={row.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <button
              onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={row.category} onValueChange={(v) => update(i, { category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.emoji} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={row.location} onValueChange={(v) => update(i, { location: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOCATIONS.map((l) => (
                  <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={row.expiry_date} onChange={(e) => update(i, { expiry_date: e.target.value })} />
            <Input type="number" step="0.01" placeholder="Price" value={row.price} onChange={(e) => update(i, { price: e.target.value })} />
          </div>
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={() => setRows([...rows, { name: "", category: "Other", location: "fridge", expiry_date: "", price: "" }])}
        className="w-full"
      >
        <Plus className="mr-1 h-4 w-4" /> Another item
      </Button>
      <Button onClick={save} disabled={saving} className="w-full h-11">
        {saving ? "Saving..." : "Save all"}
      </Button>
    </div>
  );
}
