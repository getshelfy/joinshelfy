import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/header";
import { supabase } from "@/integrations/supabase/client";
import { insertItems } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIES, LOCATIONS, categoryEmoji, guessCategory, locationEmoji, locationLabel } from "@/lib/food";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, X, Check, Keyboard, Camera } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";

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
            <TabsTrigger value="single">Scan</TabsTrigger>
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

const expiryOverlayStyle = {
  top: "31%",
  width: "64%",
  aspectRatio: "2.7 / 1",
  boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
  border: "3px solid var(--primary)",
} satisfies React.CSSProperties;

type Step = "barcode" | "expiry" | "details";

function SingleAdd() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("barcode");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("Other");
  const [location, setLocation] = useState<string>("fridge");
  const [price, setPrice] = useState("");
  const [expiry, setExpiry] = useState("");
  const [saving, setSaving] = useState(false);

  const goExpiry = () => setStep("expiry");
  const goDetails = () => setStep("details");

  const save = async () => {
    if (!name || !expiry) {
      toast.error("Name and expiry date are required");
      return;
    }
    setSaving(true);
    try {
      await insertItems([
        {
          name,
          brand: brand || null,
          category,
          location,
          expiry_date: expiry,
          price: price ? Number(price) : 0,
        },
      ]);
      toast.success("Added to your pantry 🌿");
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (step === "barcode") {
    return (
      <BarcodeScanner
        onProduct={(p) => {
          setName(p.name);
          setBrand(p.brand);
          setCategory(p.category);
          goExpiry();
        }}
        onSkipManual={(productName) => {
          if (productName) {
            setName(productName);
            setCategory(guessCategory(productName));
          }
          goExpiry();
        }}
      />
    );
  }

  if (step === "expiry") {
    return (
      <ExpiryCapture
        productName={name}
        onDate={(d) => {
          setExpiry(d);
          goDetails();
        }}
      />
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      <h3 className="font-serif text-lg">Confirm details</h3>
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Whole milk" />
      </div>
      <div className="space-y-2">
        <Label>Expiry date</Label>
        <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue>{category ? `${categoryEmoji(category)} ${category}` : undefined}</SelectValue></SelectTrigger>
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
            <SelectTrigger><SelectValue>{location ? `${locationEmoji(location)} ${locationLabel(location)}` : undefined}</SelectValue></SelectTrigger>
            <SelectContent>
              {LOCATIONS.map((l) => (
                <SelectItem key={l} value={l}>{locationEmoji(l)} {locationLabel(l)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Price (optional)</Label>
        <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="2.50" />
      </div>
      <Button onClick={save} className="w-full h-11" disabled={saving}>
        {saving ? "Saving..." : "Add to pantry"}
      </Button>
    </div>
  );
}

type FoundProduct = { name: string; brand: string; category: string };

function vibrate() {
  try { navigator.vibrate?.(60); } catch {}
}
function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 120);
  } catch {}
}

async function lookupBarcode(code: string): Promise<FoundProduct | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
    const data = await res.json();
    if (data.status === 1) {
      const p = data.product;
      const brand = (p.brands || "").split(",")[0]?.trim() || "";

      // OpenFoodFacts product_name is sometimes a marketing slogan
      // (e.g. "Fresh and creamy taste"). Try multiple fields and pick
      // the best candidate that looks like an actual product name.
      const candidates: string[] = [
        p.abbreviated_product_name,
        p.product_name_en,
        p.product_name,
        p.product_name_fr,
        p.generic_name_en,
        p.generic_name,
      ].filter((s): s is string => typeof s === "string" && s.trim().length > 0);

      const looksLikeSlogan = (s: string) => {
        const t = s.toLowerCase().trim();
        if (t.length > 60) return true;
        // Marketing phrases tend to contain these words/punctuation
        if (/[!?]/.test(t)) return true;
        if (/\b(taste|delicious|creamy|smooth|perfect|enjoy|love|original recipe|new|amazing|crunchy|tasty)\b/.test(t)) return true;
        return false;
      };

      let name = candidates.find((c) => !looksLikeSlogan(c)) || candidates[0] || "";
      name = name.trim();

      // If the name doesn't already include the brand, prepend it for clarity.
      if (brand && name && !name.toLowerCase().includes(brand.toLowerCase())) {
        name = `${brand} ${name}`;
      }
      // Fall back to brand alone if we have nothing usable.
      if (!name && brand) name = brand;

      return {
        name,
        brand,
        category: guessCategory(name, { categories: p.categories || "" }),
      };
    }
  } catch {}
  return null;
}

function BarcodeScanner({
  onProduct,
  onSkipManual,
}: {
  onProduct: (p: FoundProduct) => void;
  onSkipManual: (productName?: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const detectedRef = useRef(false);

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    // Faster scan interval (default is 500ms) for snappier detection
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 80, delayBetweenScanSuccess: 80 });
    let controls: { stop: () => void } | null = null;
    let activeStream: MediaStream | null = null;

    (async () => {
      try {
        // Request the highest practical resolution from the rear camera for crisp barcode reads
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        activeStream = stream;

        // Try to enable continuous autofocus where supported
        try {
          const track = stream.getVideoTracks()[0];
          const caps: any = track.getCapabilities?.() ?? {};
          const advanced: any[] = [];
          if (caps.focusMode?.includes?.("continuous")) advanced.push({ focusMode: "continuous" });
          if (advanced.length) await track.applyConstraints({ advanced });
        } catch {}

        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        controls = await reader.decodeFromStream(
          stream,
          videoRef.current,
          async (result) => {
            if (!result || detectedRef.current) return;
            detectedRef.current = true;
            const code = result.getText();
            vibrate();
            beep();
            setLooking(true);
            const product = await lookupBarcode(code);
            controls?.stop();
            if (product && product.name) {
              toast.success(`Found: ${product.name}`);
              onProduct(product);
            } else {
              toast.message("Couldn't find that product. Add the name.");
              onSkipManual();
            }
          },
        );
      } catch (e: any) {
        setError(e?.message || "Camera unavailable");
      }
    })();

    return () => {
      controls?.stop();
      activeStream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-black aspect-square sm:aspect-[3/4]">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />

        {/* Dim overlay with cutout */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl"
            style={{
              width: "78%",
              aspectRatio: "1.6 / 1",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
              border: "3px solid #2D9B6F",
            }}
          >
            {/* Corner accents */}
            <span className="absolute -left-1 -top-1 h-5 w-5 border-l-4 border-t-4 border-white rounded-tl-lg" />
            <span className="absolute -right-1 -top-1 h-5 w-5 border-r-4 border-t-4 border-white rounded-tr-lg" />
            <span className="absolute -left-1 -bottom-1 h-5 w-5 border-l-4 border-b-4 border-white rounded-bl-lg" />
            <span className="absolute -right-1 -bottom-1 h-5 w-5 border-r-4 border-b-4 border-white rounded-br-lg" />
            {/* Scan line */}
            <span className="absolute left-2 right-2 top-1/2 h-[2px] bg-primary/90 shadow-[0_0_12px_rgba(45,155,111,0.9)] animate-pulse" />
          </div>
        </div>

        {/* Top instruction */}
        <div className="absolute inset-x-0 top-0 p-4 text-center">
          <p className="inline-block rounded-full bg-black/55 px-3 py-1.5 text-xs text-white">
            Point at the barcode
          </p>
        </div>

        {looking && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/55 p-3 text-sm text-white">
            <Loader2 className="h-4 w-4 animate-spin" /> Looking up product…
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95 p-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => onSkipManual()} variant="secondary">Enter manually</Button>
          </div>
        )}
      </div>

      {!showManual ? (
        <button
          onClick={() => setShowManual(true)}
          className="w-full rounded-xl border bg-card py-3 text-sm font-medium"
        >
          <Keyboard className="mr-2 inline h-4 w-4" /> Can't read barcode?
        </button>
      ) : (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <Label className="text-sm">Barcode number or product name</Label>
          <Input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder="e.g. 5000295125247 or 'Whole milk'"
          />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={async () => {
                const v = manualValue.trim();
                if (!v) return;
                if (/^\d{6,}$/.test(v)) {
                  setLooking(true);
                  const product = await lookupBarcode(v);
                  setLooking(false);
                  if (product?.name) return onProduct(product);
                  toast.message("Not found — using as name.");
                  return onSkipManual(v);
                }
                onSkipManual(v);
              }}
            >
              <Check className="mr-1 h-4 w-4" /> Use this
            </Button>
            <Button variant="ghost" onClick={() => setShowManual(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpiryCapture({ productName, onDate }: { productName: string; onDate: (d: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [date, setDate] = useState("");

  useEffect(() => {
    if (manual) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e: any) {
        setError(e?.message || "Camera unavailable");
        setManual(true);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [manual]);

  const capture = async () => {
    if (!videoRef.current || busy) return;
    setBusy(true);
    try {
      const v = videoRef.current;
      const c = canvasRef.current!;
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const b64 = c.toDataURL("image/jpeg", 0.85);

      const { data, error } = await supabase.functions.invoke("scan-expiry", { body: { imageBase64: b64 } });
      if (error) throw error;
      if (data?.date) {
        toast.success(`Detected: ${data.date}`);
        onDate(data.date);
      } else {
        toast.message("Couldn't read the date — pick it manually.");
        setManual(true);
      }
    } catch (e: any) {
      toast.error(e?.message || "OCR failed");
      setManual(true);
    } finally {
      setBusy(false);
    }
  };

  if (manual) {
    return (
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div>
          <h3 className="font-serif text-lg">Expiry date</h3>
          {productName && <p className="text-sm text-muted-foreground">For {productName}</p>}
        </div>
        <div className="space-y-2">
          <Label>Pick a date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Button className="w-full h-11" disabled={!date} onClick={() => onDate(date)}>
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-black aspect-[3/4]">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />

        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl"
            style={expiryOverlayStyle}
          />
        </div>

        <div className="absolute inset-x-0 top-0 p-4 text-center">
          <p className="inline-block rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg">
            Step 2 of 2 — Now snap a photo of the expiry date
          </p>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 px-4 pb-4 pt-20">
          <button
            onClick={capture}
            disabled={busy}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-xl ring-4 ring-white/30 disabled:opacity-60"
            aria-label="Capture"
          >
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <Camera className="h-6 w-6 text-primary" />
            )}
          </button>
        </div>

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95 p-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => setManual(true)} variant="secondary">Pick date manually</Button>
          </div>
        )}
      </div>

      <button
        onClick={() => setManual(true)}
        className="w-full rounded-xl border bg-card py-3 text-sm font-medium"
      >
        Pick date manually
      </button>
    </div>
  );
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
    try {
      await insertItems(
        valid.map((r) => ({
          name: r.name,
          category: r.category,
          location: r.location,
          expiry_date: r.expiry_date,
          price: r.price ? Number(r.price) : 0,
        })),
      );
      toast.success(`Added ${valid.length} items`);
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
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
          <SelectTrigger><SelectValue>{row.category ? `${categoryEmoji(row.category)} ${row.category}` : undefined}</SelectValue></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.emoji} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={row.location} onValueChange={(v) => update(i, { location: v })}>
          <SelectTrigger><SelectValue>{row.location ? `${locationEmoji(row.location)} ${locationLabel(row.location)}` : undefined}</SelectValue></SelectTrigger>
              <SelectContent>
                {LOCATIONS.map((l) => (
              <SelectItem key={l} value={l}>{locationEmoji(l)} {locationLabel(l)}</SelectItem>
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
