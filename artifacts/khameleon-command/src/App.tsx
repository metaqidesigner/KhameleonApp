import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { LoginGate } from "@/components/LoginGate";
import MobileBriefing from "@/pages/mobile/MobileBriefing";
import { OverlayLayout } from "@/components/overlay/OverlayLayout";
import { isOverlayLayout } from "@/lib/desktopBridge";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

/**
 * No client router exists anywhere in this app - every other view is
 * driven by activeTab state inside AppShell, not a URL path. The Mobile
 * Morning Briefing is deliberately a separate top-level mode (its own
 * PWA install target, start_url in manifest.json), not another sidebar
 * tab, so it gets the one real path check in the app instead. Works with
 * zero new routing dependency because the server already does SPA
 * fallback for any non-/api path (api-server/src/app.ts) - every path
 * resolves to this same bundle, and the client decides what to render.
 */
const isMobileBriefing = window.location.pathname.startsWith("/briefing");

/**
 * Same reasoning for the Overlay layout (docs/build-review.md, Builds 0-2):
 * /overlay inside the desktop app's see-through window. In a plain browser
 * isOverlayLayout() is false and Classic renders instead.
 */
const isOverlay = isOverlayLayout();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {isOverlay ? (
        <LoginGate lockedFallback={<OverlayLayout locked />}>
          <OverlayLayout />
        </LoginGate>
      ) : (
        <LoginGate>
          {isMobileBriefing ? <MobileBriefing /> : <AppShell />}
        </LoginGate>
      )}
    </QueryClientProvider>
  );
}
