import type { ReactNode } from "react";

/** Small shared pieces for the Workspace panel's tabs (overlay glass style). */
export const TEXT = "#d6efee";
export const MUTED = "#8fb4b6";

export const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 9px", borderRadius: 8, fontSize: 12.5, fontFamily: "inherit",
  background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.12)", color: TEXT,
};

export function Btn({ children, onClick, primary, danger, disabled, label }: {
  children: ReactNode; onClick: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; label?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, flexShrink: 0,
        fontSize: 11.5, fontFamily: "inherit", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
        background: primary ? "rgba(111,230,189,0.16)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${primary ? "rgba(111,230,189,0.5)" : danger ? "rgba(255,120,120,0.35)" : "rgba(255,255,255,0.14)"}`,
        color: danger ? "#ffb0b0" : TEXT,
      }}>
      {children}
    </button>
  );
}
