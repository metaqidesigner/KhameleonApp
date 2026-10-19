import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { OverlayPalette } from "../palettes";
import { TasksTab } from "./TasksTab";
import { StatusTab } from "./StatusTab";
import { DomainsTab } from "./DomainsTab";
import { MUTED, TEXT } from "./ui";

/**
 * The Workspace panel (docs/build-review.md, Build 3; gap review Final):
 * day-to-day things, opened from the head's right-click menu. Tabs appear
 * only once they work: Tasks, Domains (gains documents in Build 5), Status.
 */

export type WorkspaceTab = "tasks" | "domains" | "status";

const TABS: { id: WorkspaceTab; label: string; render: () => ReactNode }[] = [
  { id: "tasks", label: "Tasks", render: () => <TasksTab /> },
  { id: "domains", label: "Domains & documents", render: () => <DomainsTab /> },
  { id: "status", label: "Status", render: () => <StatusTab /> },
];

export function WorkspacePanel({ palette, onClose }: { palette: OverlayPalette; onClose: () => void }) {
  const [tab, setTab] = useState<WorkspaceTab>("tasks");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const active = TABS.find(t => t.id === tab) ?? TABS[0];
  return (
    <div data-overlay-hit role="dialog" aria-label="Workspace"
      style={{
        position: "fixed", right: 84, bottom: 80, width: 420, height: "min(640px, calc(100vh - 120px))",
        display: "flex", flexDirection: "column", zIndex: 450, borderRadius: 16, overflow: "hidden",
        background: "rgba(8, 14, 28, 0.9)", border: `1px solid ${palette.chatBorder}`,
        backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", boxShadow: palette.glassShadow,
        fontFamily: "var(--j-font-ui)", color: TEXT,
      }}>
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px 8px" }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Workspace</span>
        <button type="button" className="khi-icon-btn" onClick={onClose} aria-label="Close"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
          <X size={15} color={MUTED} />
        </button>
      </div>
      <div role="tablist" aria-label="Workspace sections" style={{ display: "flex", gap: 4, padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {TABS.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            style={{
              padding: "8px 10px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5,
              color: tab === t.id ? "#6FE6BD" : MUTED,
              borderBottom: `2px solid ${tab === t.id ? "#6FE6BD" : "transparent"}`, marginBottom: -1,
            }}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16 }}>
        {active.render()}
      </div>
    </div>
  );
}
