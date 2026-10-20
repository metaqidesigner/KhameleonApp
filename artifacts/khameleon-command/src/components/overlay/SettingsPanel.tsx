import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { LookLayoutControls } from "./LookLayoutControls";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { VoiceSettings } from "@/components/settings/VoiceSettings";
import { AlertSettings } from "@/components/settings/AlertSettings";
import { DetectionSettings } from "@/components/settings/DetectionSettings";
import { AiEngines } from "@/components/settings/AiEngines";
import { MicrosoftSignIn } from "@/components/settings/MicrosoftSignIn";
import { CredentialsSettings } from "@/components/settings/CredentialsSettings";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { DataSettings } from "@/components/settings/DataSettings";
import type { OverlayPalette } from "./palettes";

/**
 * The Overlay's Settings panel (docs/gap-review.md, final answer: the
 * set-up-once things), opened from the head menu. Tabs: Profile, Look &
 * layout, Voice, AI, Microsoft sign-in, Credentials, Security (with the
 * account when team accounts are on). Integrations keep their own panel.
 * Classic shows the same sections on its Settings and Vault pages.
 */
export type SettingsTab = "profile" | "look" | "voice" | "alerts" | "detection" | "ai" | "microsoft" | "credentials" | "security";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "look", label: "Look & layout" },
  { id: "voice", label: "Voice" },
  { id: "alerts", label: "Alerts" },
  { id: "detection", label: "Detection" },
  { id: "ai", label: "AI" },
  { id: "microsoft", label: "Microsoft sign-in" },
  { id: "credentials", label: "Credentials" },
  { id: "security", label: "Security" },
];

export function SettingsPanel({ palette, initialTab = "profile", onClose, onOpenIntegrations }: {
  palette: OverlayPalette;
  initialTab?: SettingsTab;
  onClose: () => void;
  onOpenIntegrations: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div data-overlay-hit role="dialog" aria-label="Settings"
      style={{
        position: "fixed", bottom: 80, right: 84, width: 440, maxHeight: "calc(100vh - 120px)",
        zIndex: 450, borderRadius: 16, display: "flex", flexDirection: "column",
        background: "rgba(8, 14, 28, 0.92)", border: `1px solid ${palette.chatBorder}`,
        backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", boxShadow: palette.glassShadow,
        fontFamily: "var(--j-font-ui)", color: "#d6efee",
      }}>
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px 8px" }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Settings</span>
        <button type="button" className="khi-icon-btn" onClick={onClose} aria-label="Close"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
          <X size={15} color="#8fb4b6" />
        </button>
      </div>
      <div role="tablist" aria-label="Settings sections" style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 16px 12px" }}>
        {TABS.map(t => (
          <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            style={{
              fontSize: 11, padding: "4px 10px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
              background: tab === t.id ? palette.accentSoft : "transparent",
              border: `1px solid ${tab === t.id ? palette.accent : "rgba(255,255,255,0.14)"}`,
              color: tab === t.id ? "#d6efee" : "#8fb4b6",
            }}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 16px 16px" }}>
        {tab === "profile" && <ProfileSettings tone="overlay" />}
        {tab === "look" && <LookLayoutControls tone="overlay" />}
        {tab === "voice" && <VoiceSettings tone="overlay" />}
        {tab === "alerts" && <AlertSettings tone="overlay" />}
        {tab === "detection" && <DetectionSettings tone="overlay" />}
        {tab === "ai" && <AiEngines tone="overlay" onOpenIntegrations={onOpenIntegrations} />}
        {tab === "microsoft" && <MicrosoftSignIn tone="overlay" />}
        {tab === "credentials" && <CredentialsSettings tone="overlay" />}
        {tab === "security" && <><DataSettings tone="overlay" /><SecuritySettings tone="overlay" /></>}
      </div>
    </div>
  );
}
