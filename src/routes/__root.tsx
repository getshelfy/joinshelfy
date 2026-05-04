import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { InstallPrompt } from "@/components/install-prompt";
import { OfflineBanner } from "@/components/offline-banner";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
      { title: "Shelfy — Don't foget what you already have." },
      { name: "description", content: "Shelfy is a friendly food expiry tracker that helps you save food and money." },
      { name: "theme-color", content: "#2D9B6F" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Shelfy" },
      { property: "og:title", content: "Shelfy — Don't foget what you already have." },
      { name: "twitter:title", content: "Shelfy — Don't foget what you already have." },
      { property: "og:description", content: "Shelfy is a friendly food expiry tracker that helps you save food and money." },
      { name: "twitter:description", content: "Shelfy is a friendly food expiry tracker that helps you save food and money." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/64550aff-7ecd-4431-b8d0-949db4c80a4c/id-preview-1ae2f28b--c2a9322d-986e-452a-9a85-efae84e7928d.lovable.app-1777634184436.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/64550aff-7ecd-4431-b8d0-949db4c80a4c/id-preview-1ae2f28b--c2a9322d-986e-452a-9a85-efae84e7928d.lovable.app-1777634184436.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: () => <Outlet />,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <h1 className="font-serif text-4xl">Page not found</h1>
        <p className="mt-2 text-muted-foreground">That shelf is empty.</p>
      </div>
    </div>
  ),
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <OfflineBanner />
        {children}
        <InstallPrompt />
        <Toaster position="top-center" />
        <Scripts />
      </body>
    </html>
  );
}
