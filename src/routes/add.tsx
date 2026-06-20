import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/header";
import { supabase } from "@/integrations/supabase/client";
import { insertItems } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIES, LOCATIONS, categoryEmoji, defaultIncludeInRecipes, guessCategory, locationEmoji, locationLabel } from "@/lib/food";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, X, Check, Keyboard, Camera, CalendarOff, CalendarCheck, Flashlight, FlashlightOff } from "lucide-react";
import {
  DecodeHintType,
  BarcodeFormat,
  MultiFormatReader,
  RGBLuminanceSource,
  HybridBinarizer,
  GlobalHistogramBinarizer,
  BinaryBitmap,
} from "@zxing/library";

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

type Step = "barcode" | "hasExpiry" | "expiry" | "details";

function SingleAdd() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("barcode");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("Other");
  const [location, setLocation] = useState<string>("fridge");
  const [price, setPrice] = useState("");
  const [expiry, setExpiry] = useState("");
  const [isPantryStaple, setIsPantryStaple] = useState(false);
  const [includeInRecipes, setIncludeInRecipes] = useState(true);
  const [saving, setSaving] = useState(false);

  const save = async (override?: { isPantryStaple?: boolean; includeInRecipes?: boolean }) => {
    const staple = override?.isPantryStaple ?? isPantryStaple;
    const include = override?.includeInRecipes ?? includeInRecipes;
    if (!name) {
      return;
    }
    if (!staple && !expiry) {
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
          expiry_date: staple ? null : expiry,
          price: price ? Number(price) : 0,
          is_pantry_staple: staple,
          include_in_recipes: include,
        },
      ]);
      try { localStorage.setItem("shelfy:first-item-added", Date.now().toString()); } catch {}
      navigate({ to: "/" });
    } catch (err: any) {
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
          setIncludeInRecipes(defaultIncludeInRecipes(p.category));
          setStep("hasExpiry");
        }}
        onSkipManual={(productName) => {
          if (productName) {
            setName(productName);
            const cat = guessCategory(productName);
            setCategory(cat);
            setIncludeInRecipes(defaultIncludeInRecipes(cat));
          }
          setStep("hasExpiry");
        }}
      />
    );
  }

  if (step === "hasExpiry") {
    return (
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div>
          <h3 className="font-serif text-lg">Does this item have an expiry date?</h3>
          {name && <p className="text-sm text-muted-foreground mt-1">{name}</p>}
        </div>
        <div className="grid gap-2">
          <Button
            className="h-auto py-4 justify-start"
            onClick={() => {
              setIsPantryStaple(false);
              setStep("expiry");
            }}
          >
            <CalendarCheck className="mr-3 h-5 w-5 shrink-0" />
            <span className="text-left">
              <span className="block font-medium">Yes, scan it</span>
              <span className="block text-xs opacity-80">We'll remind you before it expires</span>
            </span>
          </Button>
          <Button
            variant="secondary"
            className="h-auto py-4 justify-start"
            onClick={() => {
              setIsPantryStaple(true);
              save({ isPantryStaple: true });
            }}
            disabled={saving}
          >
            <CalendarOff className="mr-3 h-5 w-5 shrink-0" />
            <span className="text-left">
              <span className="block font-medium">No expiry date</span>
              <span className="block text-xs opacity-80">Save to Pantry Staples — no reminders</span>
            </span>
          </Button>
        </div>
      </div>
    );
  }

  if (step === "expiry") {
    return (
      <ExpiryCapture
        productName={name}
        onDate={(d) => {
          setExpiry(d);
          setStep("details");
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
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setIncludeInRecipes(defaultIncludeInRecipes(v));
            }}
          >
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
      <div className="flex items-center justify-between rounded-xl border bg-card-soft px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">Suggest recipes for this item</p>
          <p className="text-xs text-muted-foreground">Include it when generating recipe ideas</p>
        </div>
        <Switch checked={includeInRecipes} onCheckedChange={setIncludeInRecipes} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Expiry dates are a guide. Always use your own judgement when deciding whether food is safe to eat.
      </p>
      <Button onClick={() => save()} className="w-full h-11" disabled={saving}>
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
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // Two-note ascending chime: E6 -> A6
    const notes = [
      { freq: 1318.5, start: 0, dur: 0.12 },
      { freq: 1760.0, start: 0.09, dur: 0.18 },
    ];
    const master = ctx.createGain();
    master.gain.value = 0.12;
    master.connect(ctx.destination);
    notes.forEach(({ freq, start, dur }) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const t0 = now + start;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(1, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    });
    setTimeout(() => { ctx.close(); }, 500);
  } catch {}
}

// Words that indicate a product_name is actually a marketing slogan
// rather than the actual product.
const SLOGAN_WORDS = /\b(taste|delicious|creamy|smooth|perfect|enjoy|love|original recipe|new|amazing|crunchy|tasty|fresh and|finest|premium quality)\b/;

function looksLikeSlogan(s: string): boolean {
  const t = s.toLowerCase().trim();
  if (t.length > 60) return true;
  if (/[!?]/.test(t)) return true;
  if (SLOGAN_WORDS.test(t)) return true;
  return false;
}

type LookupResult =
  | { status: "found"; product: FoundProduct }
  | { status: "notFound" }
  | { status: "error" };

async function lookupBarcode(code: string): Promise<LookupResult> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
    const data = await res.json();
    if (data.status !== 1) return { status: "notFound" };
    const p = data.product;
    const brand = (p.brands || "").split(",")[0]?.trim() || "";

    const candidates: string[] = [
      p.abbreviated_product_name,
      p.product_name_en,
      p.product_name,
      p.product_name_fr,
    ].filter((s): s is string => typeof s === "string" && s.trim().length > 1);

    let name = candidates.find((c) => !looksLikeSlogan(c)) || candidates[0] || "";
    name = name.trim();

    if (!name) {
      const generic = [p.generic_name_en, p.generic_name].find(
        (s) => typeof s === "string" && s.trim().length > 1 && !looksLikeSlogan(s),
      );
      if (generic) name = generic.trim();
    }

    if (brand && name && !name.toLowerCase().includes(brand.toLowerCase())) {
      name = `${brand} ${name}`;
    }
    if (!name && brand) name = brand;
    if (!name) return { status: "notFound" };

    return {
      status: "found",
      product: {
        name,
        brand,
        category: guessCategory(name, { categories: p.categories || "" }),
      },
    };
  } catch {
    return { status: "error" };
  }
}

function BarcodeScanner({
  onProduct,
  onSkipManual,
}: {
  onProduct: (p: FoundProduct) => void;
  onSkipManual: (productName?: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [processing, setProcessing] = useState(false);
  const detectedRef = useRef(false);
  const recentScansRef = useRef<{ code: string; t: number }[]>([]);

  // Allowed barcode formats (whitelist). Anything else is rejected.
  const ALLOWED_FORMATS = new Set<BarcodeFormat>([
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.QR_CODE,
  ]);

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
    ]);
    // TRY_HARDER is on by default — slower but tolerates tilt, blur and
    // partial occlusion much better. ALSO_INVERTED handles light-on-dark
    // barcodes (e.g. white bars on dark packaging).
    hints.set(DecodeHintType.TRY_HARDER, true);
    // ALSO_INVERTED isn't typed in older @zxing/library but is honoured at
    // runtime — handles light bars on dark packaging.
    hints.set((DecodeHintType as any).ALSO_INVERTED ?? 16, true);
    const reader = new MultiFormatReader();
    reader.setHints(hints);

    let activeStream: MediaStream | null = null;
    let rafId = 0;
    let cancelled = false;
    let processingClearTimer = 0;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const rotCanvas = document.createElement("canvas");
    const rotCtx = rotCanvas.getContext("2d");

    function luminancesFrom(data: ImageData): Uint8ClampedArray {
      const { data: px } = data;
      const out = new Uint8ClampedArray(px.length / 4);
      for (let i = 0, j = 0; i < px.length; i += 4, j++) {
        // Greyscale via standard luma — reduces colour-cast / reflection noise.
        out[j] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114 + 500) / 1000;
      }
      return out;
    }

    function boostContrast(lum: Uint8ClampedArray, factor: number): Uint8ClampedArray {
      // Stretch contrast around the mean — helps low-contrast / glare-washed
      // barcodes where bars and spaces are too similar in brightness.
      let sum = 0;
      for (let i = 0; i < lum.length; i++) sum += lum[i];
      const mean = sum / lum.length;
      const out = new Uint8ClampedArray(lum.length);
      for (let i = 0; i < lum.length; i++) {
        const v = (lum[i] - mean) * factor + mean;
        out[i] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      return out;
    }

    function bitmapFromLum(
      lum: Uint8ClampedArray,
      w: number,
      h: number,
      binarizer: "hybrid" | "global",
    ): BinaryBitmap {
      const source = new RGBLuminanceSource(lum as unknown as Uint8ClampedArray, w, h);
      const bin =
        binarizer === "hybrid"
          ? new HybridBinarizer(source as any)
          : new GlobalHistogramBinarizer(source as any);
      return new BinaryBitmap(bin);
    }

    function tryDecode(bitmap: BinaryBitmap): { text: string; format: BarcodeFormat } | null {
      try {
        const r = reader.decode(bitmap);
        const fmt = r.getBarcodeFormat();
        if (!ALLOWED_FORMATS.has(fmt)) return null;
        return { text: r.getText(), format: fmt };
      } catch {
        return null;
      } finally {
        reader.reset();
      }
    }

    function decodePasses(lum: Uint8ClampedArray, w: number, h: number) {
      // Pass 1: hybrid binarizer (adaptive, best for uneven lighting/glare)
      let r = tryDecode(bitmapFromLum(lum, w, h, "hybrid"));
      if (r) return r;
      // Pass 2: global histogram binarizer (better for clean prints)
      r = tryDecode(bitmapFromLum(lum, w, h, "global"));
      if (r) return r;
      // Pass 3: high-contrast retry — recovers low-contrast / glare-affected barcodes
      const boosted = boostContrast(lum, 1.8);
      r = tryDecode(bitmapFromLum(boosted, w, h, "hybrid"));
      if (r) return r;
      // Pass 4: extra-aggressive contrast
      const boostedMore = boostContrast(lum, 2.6);
      return tryDecode(bitmapFromLum(boostedMore, w, h, "hybrid"));
    }

    function registerCandidate(code: string): boolean {
      // Multi-frame agreement gate. Two matches within 1.2s = confirmed.
      // Lower than before (was 3) because TRY_HARDER + contrast passes give
      // us higher per-frame confidence, and motion makes 3 same-frame hits
      // unreliable for moving packaging.
      const now = Date.now();
      const recent = recentScansRef.current.filter((s) => now - s.t < 1200);
      recent.push({ code, t: now });
      recentScansRef.current = recent;
      const matching = recent.filter((s) => s.code === code).length;
      return matching >= 2;
    }

    async function handleFound(code: string) {
      if (detectedRef.current) return;
      detectedRef.current = true;
      setLooking(true);
      const lookup = await lookupBarcode(code);
      const isNumeric = /^\d+$/.test(code);
      const lengthOk = !isNumeric || (code.length >= 8 && code.length <= 14);

      if (lookup.status === "notFound" && !lengthOk) {
        toast.error("Barcode not recognised — try again or enter manually");
        recentScansRef.current = [];
        detectedRef.current = false;
        setLooking(false);
        return;
      }

      vibrate();
      beep();
      if (lookup.status === "found") {
        onProduct(lookup.product);
      } else {
        onSkipManual();
      }
    }

    function flashProcessing() {
      setProcessing(true);
      clearTimeout(processingClearTimer);
      processingClearTimer = window.setTimeout(() => setProcessing(false), 140) as unknown as number;
    }

    function scanLoop() {
      if (cancelled || detectedRef.current) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && ctx && rotCtx) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw && vh) {
          const maxDim = 720;
          const scale = Math.min(1, maxDim / Math.max(vw, vh));
          const w = Math.round(vw * scale);
          const h = Math.round(vh * scale);
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h);

          flashProcessing();

          const lum = luminancesFrom(data);
          let result = decodePasses(lum, w, h);

          const rotateAndDecode = (angle: number) => {
            const swap = angle === 90 || angle === 270;
            const rw = swap ? h : w;
            const rh = swap ? w : h;
            rotCanvas.width = rw;
            rotCanvas.height = rh;
            rotCtx.save();
            rotCtx.translate(rw / 2, rh / 2);
            rotCtx.rotate((angle * Math.PI) / 180);
            rotCtx.drawImage(canvas, -w / 2, -h / 2);
            rotCtx.restore();
            const rd = rotCtx.getImageData(0, 0, rw, rh);
            return decodePasses(luminancesFrom(rd), rw, rh);
          };

          if (!result) result = rotateAndDecode(90);
          // Small-angle retries handle naturally-tilted packaging.
          if (!result) result = rotateAndDecode(15);
          if (!result) result = rotateAndDecode(-15);
          if (!result) result = rotateAndDecode(180);
          if (!result) result = rotateAndDecode(270);

          if (result && registerCandidate(result.text)) {
            handleFound(result.text);
            return;
          }
        }
      }
      // Faster cadence — ~16 fps of attempts, was ~8.
      rafId = window.setTimeout(scanLoop, 60) as unknown as number;
    }

    (async () => {
      try {
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

        try {
          const track = stream.getVideoTracks()[0];
          trackRef.current = track;
          const caps: any = track.getCapabilities?.() ?? {};
          if (caps.torch) setTorchSupported(true);
          const advanced: any[] = [];
          if (caps.focusMode?.includes?.("continuous")) advanced.push({ focusMode: "continuous" });
          if (advanced.length) await track.applyConstraints({ advanced });
        } catch {}

        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scanLoop();
      } catch (e: any) {
        setError(e?.message || "Camera unavailable");
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(rafId);
      trackRef.current = null;
      activeStream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-black aspect-square sm:aspect-[3/4]">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl transition-shadow duration-150"
            style={{
              width: "78%",
              aspectRatio: "1.6 / 1",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
              border: processing ? "3px solid #7DE3B3" : "3px solid #2D9B6F",
              outline: processing ? "2px solid rgba(125,227,179,0.55)" : "none",
              outlineOffset: "2px",
            }}
          >
            <span className="absolute -left-1 -top-1 h-5 w-5 border-l-4 border-t-4 border-white rounded-tl-lg" />
            <span className="absolute -right-1 -top-1 h-5 w-5 border-r-4 border-t-4 border-white rounded-tr-lg" />
            <span className="absolute -left-1 -bottom-1 h-5 w-5 border-l-4 border-b-4 border-white rounded-bl-lg" />
            <span className="absolute -right-1 -bottom-1 h-5 w-5 border-r-4 border-b-4 border-white rounded-br-lg" />
            <span className="absolute left-2 right-2 top-1/2 h-[2px] bg-primary/90 shadow-[0_0_12px_rgba(45,155,111,0.9)] animate-pulse" />
          </div>
        </div>

        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
          <span className="rounded-full bg-black/55 px-3 py-1.5 text-xs text-white">
            Point at the barcode
          </span>
          {torchSupported && (
            <button
              type="button"
              onClick={toggleTorch}
              aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md transition ${
                torchOn ? "bg-primary" : "bg-black/55 hover:bg-black/70"
              }`}
            >
              {torchOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
            </button>
          )}
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
                  const lookup = await lookupBarcode(v);
                  setLooking(false);
                  if (lookup.status === "found") return onProduct(lookup.product);
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
        vibrate();
        toast.success(`Detected: ${data.date}`);
        onDate(data.date);
      } else {
        setManual(true);
      }
    } catch (e: any) {
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

type BulkRow = {
  name: string;
  category: string;
  location: string;
  expiry_date: string;
  price: string;
  is_pantry_staple: boolean;
  include_in_recipes: boolean;
};

function newBulkRow(): BulkRow {
  return {
    name: "",
    category: "Other",
    location: "fridge",
    expiry_date: "",
    price: "",
    is_pantry_staple: false,
    include_in_recipes: defaultIncludeInRecipes("Other"),
  };
}

function BulkAdd() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BulkRow[]>([newBulkRow()]);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<BulkRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    const valid = rows.filter((r) => r.name && (r.is_pantry_staple || r.expiry_date));
    if (!valid.length) return;
    setSaving(true);
    try {
      await insertItems(
        valid.map((r) => ({
          name: r.name,
          category: r.category,
          location: r.location,
          expiry_date: r.is_pantry_staple ? null : r.expiry_date,
          price: r.price ? Number(r.price) : 0,
          is_pantry_staple: r.is_pantry_staple,
          include_in_recipes: r.include_in_recipes,
        })),
      );
      try { localStorage.setItem("shelfy:first-item-added", Date.now().toString()); } catch {}
      navigate({ to: "/" });
    } catch (err: any) {
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
            <Select
              value={row.category}
              onValueChange={(v) => update(i, { category: v, include_in_recipes: defaultIncludeInRecipes(v) })}
            >
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
          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-5">
            <Input
              type="date"
              className="w-full min-w-0 sm:col-span-3"
              value={row.expiry_date}
              disabled={row.is_pantry_staple}
              onChange={(e) => update(i, { expiry_date: e.target.value })}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Price"
              className="w-full min-w-0 sm:col-span-2"
              value={row.price}
              onChange={(e) => update(i, { price: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-card-soft px-2.5 py-1.5 text-xs">
            <label className="flex items-center gap-2">
              <Switch
                checked={row.is_pantry_staple}
                onCheckedChange={(v) => update(i, { is_pantry_staple: v })}
              />
              Pantry staple (no expiry)
            </label>
            <label className="flex items-center gap-2">
              <Switch
                checked={row.include_in_recipes}
                onCheckedChange={(v) => update(i, { include_in_recipes: v })}
              />
              In recipes
            </label>
          </div>
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={() => setRows([...rows, newBulkRow()])}
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
