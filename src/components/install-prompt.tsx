import { useEffect, useState } from "react";
import { Download, Share, X, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "shelfy:install-prompt-dismissed-at";
const DISMISS_DAYS = 3;
const FIRST_ITEM_KEY = "shelfy:first-item-added";

function hasAddedFirstItem() {
  try {
    return !!localStorage.getItem(FIRST_ITEM_KEY);
  } catch {
    return false;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS
    window.navigator.standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}

function recentlyDismissed() {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const ts = parseInt(v, 10);
    if (!ts) return false;
    return Date.now() - ts < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const ios = isIOS();

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    let iosTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (hasAddedFirstItem()) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    // Poll for the first-item flag so the prompt appears right after the user adds their first item.
    pollTimer = setInterval(() => {
      if (hasAddedFirstItem()) {
        setShow(true);
        if (pollTimer) clearInterval(pollTimer);
      }
    }, 1000);

    // iOS doesn't fire beforeinstallprompt — show shortly after the first item is added
    if (ios) {
      const tryShow = () => {
        if (hasAddedFirstItem()) {
          iosTimer = setTimeout(() => setShow(true), 1500);
          return true;
        }
        return false;
      };
      if (!tryShow()) {
        const iosPoll = setInterval(() => {
          if (tryShow()) clearInterval(iosPoll);
        }, 1000);
        return () => {
          clearInterval(iosPoll);
          if (iosTimer) clearTimeout(iosTimer);
          if (pollTimer) clearInterval(pollTimer);
          window.removeEventListener("beforeinstallprompt", onBip);
        };
      }
    }

    return () => {
      if (iosTimer) clearTimeout(iosTimer);
      if (pollTimer) clearInterval(pollTimer);
      window.removeEventListener("beforeinstallprompt", onBip);
    };
  }, [ios]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {}
    setShow(false);
    setShowIosHelp(false);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted" || outcome === "dismissed") {
        setDeferred(null);
        setShow(false);
        if (outcome === "dismissed") dismiss();
      }
    } else {
      // No native prompt available (iOS, or Android browsers that don't fire it)
      setShowIosHelp(true);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl border bg-card p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          {showIosHelp ? (
            <>
              <h3 className="font-medium">Add Shelfy to your Home Screen</h3>
              {ios ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Tap the <Share className="inline h-3.5 w-3.5 align-text-bottom" /> Share button, then choose
                  <span className="font-medium"> "Add to Home Screen"</span>.
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  Tap the <MoreVertical className="inline h-3.5 w-3.5 align-text-bottom" /> More menu (3 dots) in your browser,
                  then choose <span className="font-medium">"Add to Home Screen"</span> or
                  <span className="font-medium"> "Install app"</span>.
                </p>
              )}
              <div className="mt-3">
                <Button size="sm" variant="ghost" onClick={dismiss} className="h-9">
                  Got it
                </Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-medium">Add Shelfy to your Home Screen</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Install Shelfy for the full app experience.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={install} className="h-9">
                  {deferred ? "Install" : "Show me how"}
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss} className="h-9">
                  Not now
                </Button>
              </div>
            </>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
