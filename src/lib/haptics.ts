// Tiny helpers for tactile feedback. Vibration only fires on supporting devices
// (mostly Android) and is a no-op everywhere else, so this is safe to call freely.

export function haptic(pattern: number | number[] = 8) {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  try {
    nav.vibrate?.(pattern);
  } catch {
    // ignore
  }
}

export const tap = () => haptic(8);
export const tapLight = () => haptic(4);
export const tapSuccess = () => haptic([10, 30, 10]);
