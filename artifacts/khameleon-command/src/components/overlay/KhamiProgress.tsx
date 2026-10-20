import { useEffect, useRef, useState } from "react";
import { getKhamiSetup, downloadKhamiBrain, type KhamiSetup } from "@/lib/khamiApi";
import { getOnboardingStatus } from "@/lib/khameleonApi";
import { useKhameleonStore } from "@/store/khameleonStore";
import type { OverlayPalette } from "./palettes";

/**
 * Keeps Khami's first download going after setup (download decisions, step 2):
 * if Khami isn't ready and nothing is downloading - e.g. the app was closed
 * mid-download, or the internet dropped - it starts the standard brain again
 * and shows a small "Getting Khami ready…" note by the head. Hidden once Khami
 * is ready, and while the first-run setup (which shows its own progress) is open.
 */
export function KhamiProgress({ palette, bottom }: { palette: OverlayPalette; bottom: number }) {
  const setupOpen = useKhameleonStore(s => s.onboardingWizardOpen);
  const [setup, setSetup] = useState<KhamiSetup | null>(null);
  const tried = useRef(false);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const s = await getKhamiSetup();
        if (stop) return;
        setSetup(s);
        if (s.active || s.download.state === "downloading" || tried.current) return;
        if (s.brains.some(b => b.downloaded)) return; // a brain is there, just not chosen - Settings handles that
        const { onboardingComplete } = await getOnboardingStatus();
        if (!onboardingComplete) return; // the setup starts it
        tried.current = true;
        setSetup({ ...s, download: await downloadKhamiBrain("standard") });
      } catch { /* server starting */ }
    };
    void poll();
    const id = setInterval(poll, 3000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  const d = setup?.download;
  if (!setup || setup.active || setupOpen || !d || (d.state !== "downloading" && d.state !== "error")) return null;
  const retry = () => { tried.current = false; void downloadKhamiBrain("standard").then(dl => setSetup(s => (s ? { ...s, download: dl } : s))).catch(() => {}); };

  return (
    <div data-overlay-hit role="status" style={{
      position: "fixed", right: 18, bottom, width: 230, zIndex: 410, padding: "9px 12px", borderRadius: 12,
      background: palette.chatBg, border: `1px solid ${palette.chatBorder}`, boxShadow: palette.glassShadow,
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", fontFamily: "var(--j-font-ui)", fontSize: 11.5, color: palette.textMuted,
    }}>
      {d.state === "downloading" ? (
        <>
          <div>Getting Khami ready… {d.percent ?? 0}%</div>
          <div style={{ height: 3, borderRadius: 2, background: palette.glassBorder, marginTop: 6, overflow: "hidden" }}>
            <div style={{ width: `${d.percent ?? 0}%`, height: "100%", background: palette.accent, transition: "width 0.6s ease" }} />
          </div>
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1 }}>Khami's download stopped - check the internet connection.</span>
          <button type="button" onClick={retry} style={{ padding: "3px 9px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "inherit", background: palette.accentSoft, border: `1px solid ${palette.accent}`, color: palette.text }}>Retry</button>
        </div>
      )}
    </div>
  );
}
