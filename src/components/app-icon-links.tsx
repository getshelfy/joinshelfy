/**
 * Single source of truth for the app's bookmark / home-screen icon.
 *
 * Every platform (iOS Safari, Android Chrome, desktop browsers, PWA install)
 * pulls from the same master PNG so the icon is identical everywhere.
 *
 * Used by both the document <head> (via getAppIconLinks) and the web app
 * manifest (see public/manifest.webmanifest, which references the same file).
 */
export const APP_ICON_SRC = "/icon-512.png";
export const APP_ICON_TYPE = "image/png";

/** Sizes Apple/Android expect; all served by the same master PNG. */
const APPLE_TOUCH_SIZES = ["180x180", "167x167", "152x152", "120x120"] as const;
const FAVICON_SIZES = ["512x512", "192x192", "32x32", "16x16"] as const;

export function getAppIconLinks() {
  return [
    ...APPLE_TOUCH_SIZES.map((sizes) => ({
      rel: "apple-touch-icon",
      sizes,
      href: APP_ICON_SRC,
    })),
    ...FAVICON_SIZES.map((sizes) => ({
      rel: "icon",
      type: APP_ICON_TYPE,
      sizes,
      href: APP_ICON_SRC,
    })),
    { rel: "shortcut icon", type: APP_ICON_TYPE, href: APP_ICON_SRC },
    { rel: "mask-icon", href: APP_ICON_SRC, color: "#2D9B6F" },
  ];
}
