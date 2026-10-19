import { useEffect, useState } from "react";
import { useKhameleonStore, type OverlayPrefs } from "@/store/khameleonStore";
import { desktopPrefsBridge, type DesktopPrefs } from "@/lib/desktopBridge";

/**
 * Look & layout choices, shared by both layouts: the Overlay opens it from
 * the head's right-click menu, Classic shows it in Settings -> Appearance.
 * Becomes the "Look & layout" tab of the Settings panel in Build 3.
 *
 * Look choices are saved in the app (shared by every window); the two
 * desktop choices are saved by the desktop app and only appear inside it.
 */

type Tone = "overlay" | "classic";

const TONES: Record<Tone, { text: string; muted: string; chipBg: string; chipBorder: string; activeBg: string; activeBorder: string; activeText: string }> = {
  overlay: {
    text: "#d6efee", muted: "#8fb4b6",
    chipBg: "rgba(255,255,255,0.05)", chipBorder: "rgba(255,255,255,0.14)",
    activeBg: "rgba(111,230,189,0.16)", activeBorder: "rgba(111,230,189,0.55)", activeText: "#6FE6BD",
  },
  classic: {
    text: "var(--j-text)", muted: "var(--j-text-muted)",
    chipBg: "rgba(0,4,8,0.6)", chipBorder: "rgba(0,212,255,0.15)",
    activeBg: "rgba(0,212,255,0.1)", activeBorder: "var(--j-cyan)", activeText: "var(--j-cyan)",
  },
};

function Choice<T extends string>({ label, hint, value, options, onChange, tone }: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  tone: Tone;
}) {
  const t = TONES[tone];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: tone === "classic" ? 10 : 11.5, fontWeight: 600, color: t.text, letterSpacing: tone === "classic" ? "0.12em" : undefined, textTransform: tone === "classic" ? "uppercase" : undefined }}>
        {label}
      </div>
      <div role="radiogroup" aria-label={label} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map(o => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              style={{
                padding: "6px 11px", borderRadius: tone === "classic" ? 2 : 8, cursor: "pointer",
                fontSize: 12, fontFamily: "inherit",
                background: active ? t.activeBg : t.chipBg,
                border: `1px solid ${active ? t.activeBorder : t.chipBorder}`,
                color: active ? t.activeText : t.text,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && <div style={{ fontSize: 11, color: t.muted, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

/** Picks up look changes saved from another Khameleon window (same browser storage). */
export function useSyncAcrossWindows() {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "jarvis-ui") void useKhameleonStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}

export function LookLayoutControls({ tone }: { tone: Tone }) {
  const prefs = useKhameleonStore(s => s.overlayPrefs);
  const setPref = useKhameleonStore(s => s.setOverlayPref);
  const desktop = desktopPrefsBridge();
  const [desktopPrefs, setDesktopPrefs] = useState<DesktopPrefs | null>(null);

  useEffect(() => {
    desktop?.get().then(setDesktopPrefs).catch(() => {});
  }, [desktop]);

  const setDesktop = (patch: Partial<DesktopPrefs>) => {
    desktop?.set(patch).then(setDesktopPrefs).catch(() => {});
  };

  const set = <K extends keyof OverlayPrefs>(k: K) => (v: OverlayPrefs[K]) => setPref(k, v);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {desktop && desktopPrefs && (
        <>
          <Choice
            tone={tone}
            label="Layout"
            value={desktopPrefs.layout}
            onChange={layout => setDesktop({ layout })}
            options={[{ value: "overlay", label: "Overlay" }, { value: "classic", label: "Classic dashboard" }]}
            hint="Overlay floats over your other apps; Classic is the full dashboard in a normal window. Switches straight away and is remembered next time."
          />
          <Choice
            tone={tone}
            label="Which screen"
            value={desktopPrefs.screen}
            onChange={screen => setDesktop({ screen })}
            options={[{ value: "follow", label: "Follow me" }, { value: "primary", label: "Main screen only" }]}
            hint="With more than one screen, Follow me moves Khameleon to whichever screen you're working on."
          />
          <Choice
            tone={tone}
            label="Email assistant"
            value={desktopPrefs.emailAssistant ? "on" : "off"}
            onChange={v => setDesktop({ emailAssistant: v === "on" })}
            options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]}
            hint="When you open an email, Khami offers a summary, a suggested reply and things to do beside it - a card for new mail from people, a button for the rest. Khameleon never sends anything."
          />
          <Choice
            tone={tone}
            label="Words on window glows"
            value={desktopPrefs.glowLabels ? "on" : "off"}
            onChange={v => setDesktop({ glowLabels: v === "on" })}
            options={[{ value: "on", label: "Show" }, { value: "off", label: "Hide" }]}
            hint="The glow around a window shows what Khameleon is doing by colour; the small label says it in words too (Reading, Working, Needs you…). Glows stop moving when Reduce motion is on in your computer's settings."
          />
        </>
      )}
      <Choice
        tone={tone}
        label="Overlay colours"
        value={prefs.palette}
        onChange={set("palette")}
        options={[{ value: "brand-teal", label: "Khameleon teal" }, { value: "soft-blue", label: "Soft blue" }]}
      />
      <Choice
        tone={tone}
        label="Toolbar icons"
        value={prefs.iconStyle}
        onChange={set("iconStyle")}
        options={[{ value: "glass", label: "Glass pills" }, { value: "bare", label: "Icons only" }]}
      />
      <Choice
        tone={tone}
        label="When you're not using the toolbars"
        value={prefs.idleStyle}
        onChange={set("idleStyle")}
        options={[{ value: "fade", label: "Fade" }, { value: "edge", label: "Hide until I reach the edge" }, { value: "always", label: "Always show" }]}
      />
      <Choice
        tone={tone}
        label="Top and bottom"
        value={prefs.edgeChrome}
        onChange={set("edgeChrome")}
        options={[{ value: "none", label: "Nothing" }, { value: "bars", label: "Bars" }, { value: "icons", label: "Floating icons" }]}
        hint="Adds usage so far, a domain picker and recent activity along the top and bottom edges."
      />
    </div>
  );
}
