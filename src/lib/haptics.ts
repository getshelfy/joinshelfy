// Tiny helpers for tactile feedback. Vibration only fires on supporting devices
// (mostly Android) and is a no-op everywhere else. Respects prefers-reduced-motion.

function reducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function haptic(pattern: number | number[] = 8) {
  if (typeof navigator === "undefined") return;
  if (reducedMotion()) return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  try {
    nav.vibrate?.(pattern);
  } catch {
    // ignore
  }
}

export const tap = () => haptic(6);
export const tapLight = () => haptic(3);
export const tapSelect = () => haptic(10);
export const tapSuccess = () => haptic([8, 24, 8]);
export const tapWarn = () => haptic([4, 16, 4, 16]);
