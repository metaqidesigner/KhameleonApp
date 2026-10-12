import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlignLeft, ChevronLeft, ChevronRight, Crosshair, FileText, Filter, BookOpen,
  MessageCircle, PenLine, RefreshCw, Search, Sparkles, Table2, ZoomIn,
} from "lucide-react";
import type { OverlayPalette } from "./palettes";
import type { ChatToolId } from "@/store/jarvisStore";

/**
 * The four edge toolbars (docs/build-review.md, Build 2). Left: Capture &
 * Extract, Create & Draft. Right: Transform & Clean, Ask & Find.
 *
 * Only real actions are clickable. An action with no `run` is shown dimmed
 * with a note saying when it arrives - never a button that does nothing.
 *
 * Idle behaviour (Build 2 addendum): a few seconds after the pointer leaves,
 * each side fades to a faint outline; it comes back as soon as the pointer
 * nears that edge.
 */
export interface ToolbarAction {
  id: string;
  label: string;
  icon: ReactNode;
  run?: () => void;
  /** Shown in the tooltip when `run` is missing. */
  comingWith?: string;
}

export interface ToolbarGroup {
  title: string;
  actions: ToolbarAction[];
}

const ICON = { size: 15, strokeWidth: 1.5 } as const;
const IDLE_AFTER_MS = 3000;
const WAKE_DISTANCE_PX = 110;
const IDLE_OPACITY = 0.25;

export function defaultToolbarGroups(handlers: { askKhameleon: () => void; openTool: (tool: ChatToolId) => void }): {
  left: ToolbarGroup[];
  right: ToolbarGroup[];
} {
  return {
    left: [
      {
        title: "Capture & Extract",
        actions: [
          { id: "extract", label: "Extract data", icon: <Crosshair {...ICON} />, comingWith: "Arrives with Capture" },
          { id: "to-sheet", label: "To spreadsheet", icon: <Table2 {...ICON} />, comingWith: "Arrives with Capture" },
          { id: "inspect", label: "Inspect region", icon: <ZoomIn {...ICON} />, comingWith: "Arrives with Capture" },
        ],
      },
      {
        title: "Create & Draft",
        actions: [
          { id: "draft-reply", label: "Draft reply", icon: <PenLine {...ICON} />, run: () => handlers.openTool("draft-reply") },
          { id: "new-doc", label: "New document", icon: <FileText {...ICON} />, comingWith: "Not built yet" },
          { id: "summarize", label: "Summarize email thread", icon: <AlignLeft {...ICON} />, run: () => handlers.openTool("summarize-thread") },
        ],
      },
    ],
    right: [
      {
        title: "Transform & Clean",
        actions: [
          { id: "sort-inbox", label: "Sort inbox", icon: <Filter {...ICON} />, run: () => handlers.openTool("sort-inbox") },
          { id: "reformat", label: "Reformat", icon: <RefreshCw {...ICON} />, comingWith: "Not built yet" },
          { id: "polish", label: "Polish wording", icon: <Sparkles {...ICON} />, run: () => handlers.openTool("polish") },
        ],
      },
      {
        title: "Ask & Find",
        actions: [
          { id: "ask", label: "Ask Khameleon", icon: <MessageCircle {...ICON} />, run: handlers.askKhameleon },
          { id: "search-memory", label: "Search memory", icon: <Search {...ICON} />, run: () => handlers.openTool("search-memory") },
          { id: "research", label: "Research a question", icon: <BookOpen {...ICON} />, run: () => handlers.openTool("research") },
        ],
      },
    ],
  };
}

/** Fades a side out when idle and back in when the pointer nears its edge. */
function useEdgeWake(side: "left" | "right", holdAwake: boolean): boolean {
  const [awake, setAwake] = useState(true);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const scheduleSleep = () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setAwake(false), IDLE_AFTER_MS);
    };
    const onMove = (e: MouseEvent) => {
      const distance = side === "left" ? e.clientX : window.innerWidth - e.clientX;
      if (distance <= WAKE_DISTANCE_PX) {
        setAwake(true);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = null;
      } else if (timer.current === null) {
        scheduleSleep();
      }
    };
    document.addEventListener("mousemove", onMove);
    scheduleSleep();
    return () => {
      document.removeEventListener("mousemove", onMove);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [side]);

  return awake || holdAwake;
}

function ToolbarPill({ group, palette, side }: { group: ToolbarGroup; palette: OverlayPalette; side: "left" | "right" }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const hoveredAction = hovered !== null ? group.actions[hovered] : null;

  return (
    <div style={{ position: "relative" }} role="toolbar" aria-label={group.title} aria-orientation="vertical">
      <div
        style={{
          width: 36, padding: "10px 0", borderRadius: 18,
          background: palette.glass, border: `1px solid ${palette.glassBorder}`,
          backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
          boxShadow: palette.glassShadow,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
        }}
      >
        {group.actions.map((action, i) => {
          const enabled = !!action.run;
          return (
            <button
              key={action.id}
              type="button"
              className={enabled ? "khi-icon-btn" : undefined}
              aria-label={enabled ? action.label : `${action.label} (${action.comingWith ?? "not available yet"})`}
              aria-disabled={!enabled}
              onClick={enabled ? action.run : undefined}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              style={{
                background: "none", border: "none", padding: 0,
                cursor: enabled ? "pointer" : "default",
                width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
                color: enabled && hovered === i ? palette.iconHover : palette.iconColor,
                opacity: enabled ? 1 : 0.38,
                transition: "color 120ms ease",
              }}
            >
              {action.icon}
            </button>
          );
        })}
      </div>

      {hoveredAction && (
        <div
          role="tooltip"
          style={{
            position: "absolute", top: 8 + hovered! * 34, [side === "left" ? "left" : "right"]: 46,
            background: "rgba(14,22,38,0.94)", color: "#f0f4fb",
            fontSize: 11, padding: "6px 10px", borderRadius: 7, whiteSpace: "nowrap",
            boxShadow: "0 4px 14px rgba(0,0,0,0.3)", pointerEvents: "none",
            display: "flex", flexDirection: "column", gap: 2,
          }}
        >
          <span>{hoveredAction.label}</span>
          {!hoveredAction.run && hoveredAction.comingWith && (
            <span style={{ fontSize: 10, color: "#9fb3c8" }}>{hoveredAction.comingWith}</span>
          )}
        </div>
      )}
    </div>
  );
}

function EdgeToolbars({ groups, palette, side }: { groups: ToolbarGroup[]; palette: OverlayPalette; side: "left" | "right" }) {
  const [collapsed, setCollapsed] = useState(false);
  const [pointerInside, setPointerInside] = useState(false);
  const awake = useEdgeWake(side, pointerInside);
  const Chevron = (side === "left") !== collapsed ? ChevronLeft : ChevronRight;

  return (
    <div
      data-overlay-hit
      onMouseEnter={() => setPointerInside(true)}
      onMouseLeave={() => setPointerInside(false)}
      style={{
        position: "fixed", [side]: collapsed ? 0 : 14, top: "50%", transform: "translateY(-50%)",
        display: "flex", alignItems: "center", gap: 6,
        flexDirection: side === "left" ? "row" : "row-reverse",
        opacity: awake ? 1 : IDLE_OPACITY,
        transition: "opacity 260ms ease",
        zIndex: 100,
      }}
    >
      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map(g => <ToolbarPill key={g.title} group={g} palette={palette} side={side} />)}
        </div>
      )}
      <button
        type="button"
        className="khi-icon-btn"
        onClick={() => setCollapsed(c => !c)}
        aria-label={collapsed ? "Show toolbars" : "Hide toolbars"}
        title={collapsed ? "Show toolbars" : "Hide toolbars"}
        style={{
          cursor: "pointer", padding: 0,
          width: collapsed ? 14 : 22, height: collapsed ? 54 : 22,
          borderRadius: collapsed ? (side === "left" ? "0 8px 8px 0" : "8px 0 0 8px") : "50%",
          background: palette.glass, border: `1px solid ${palette.glassBorder}`,
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          boxShadow: palette.glassShadow,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Chevron size={11} color={palette.iconColor} />
      </button>
    </div>
  );
}

export function Toolbars({ palette, groups }: {
  palette: OverlayPalette;
  groups: { left: ToolbarGroup[]; right: ToolbarGroup[] };
}) {
  return (
    <>
      <EdgeToolbars groups={groups.left} palette={palette} side="left" />
      <EdgeToolbars groups={groups.right} palette={palette} side="right" />
    </>
  );
}
