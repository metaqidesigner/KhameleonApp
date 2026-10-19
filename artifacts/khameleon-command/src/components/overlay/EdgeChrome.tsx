import { useEffect, useState, type ReactNode } from "react";
import { Activity, Clock3, Filter, MessageSquare, Radio, Receipt } from "lucide-react";
import { useKhameleonStore } from "@/store/khameleonStore";
import { getWorkDomains, type WorkDomain } from "@/lib/workDomainsApi";
import type { KhameleonTelemetry, FeedItem } from "@/lib/khameleonApi";
import type { OverlayPalette } from "./palettes";

/**
 * Optional top/bottom chrome (sample Options 3 and 4, now real): usage so
 * far, a domain picker, and recent activity. Off by default.
 *
 * Everything shown is real or absent: usage and activity come straight
 * from the server with no stand-in numbers if it can't be reached, and
 * energy is left out until it's measured honestly (gap review Q2).
 */

const BASE = import.meta.env.VITE_API_URL || "/api";
const REFRESH_MS = 30_000;
const BARE_SHADOW = "drop-shadow(0 1px 2px rgba(0,0,0,0.45)) drop-shadow(0 1px 6px rgba(0,0,0,0.25))";

function usePolled<T>(path: string): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetch(`${BASE}${path}`)
      .then(r => (r.ok ? r.json() as Promise<T> : null))
      .then(d => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(null); });
    void load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, [path]);
  return data;
}

function useEdgeData() {
  const telemetry = usePolled<KhameleonTelemetry>("/telemetry");
  const feed = usePolled<FeedItem[]>("/feed");
  const [domains, setDomains] = useState<WorkDomain[]>([]);
  useEffect(() => { getWorkDomains().then(setDomains).catch(() => {}); }, []);
  const domainId = useKhameleonStore(s => s.chatLastDomainId);
  const setDomainId = useKhameleonStore(s => s.setChatLastDomainId);
  return { telemetry, feed: feed ?? [], domains, domainId, setDomainId };
}

const SINCE = "Since Khameleon's server last started";

function stats(t: KhameleonTelemetry | null) {
  if (!t) return [];
  return [
    { icon: <MessageSquare size={13} strokeWidth={1.5} />, label: "Questions", value: String(t.total_queries) },
    { icon: <Clock3 size={13} strokeWidth={1.5} />, label: "Avg response", value: t.avg_latency_ms ? `${(t.avg_latency_ms / 1000).toFixed(1)}s` : "–" },
    { icon: <Receipt size={13} strokeWidth={1.5} />, label: "Cost", value: `$${t.cost_usd.toFixed(2)}` },
  ];
}

function feedLine(f: FeedItem) {
  return `${f.agent}: ${f.prompt}`;
}

function DomainChips({ palette, data, size = 10 }: { palette: OverlayPalette; data: ReturnType<typeof useEdgeData>; size?: number }) {
  const all = [{ id: "all" as const, name: "All domains" }, ...data.domains];
  return (
    <div role="radiogroup" aria-label="Work domain" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {all.map(d => {
        const active = data.domainId === d.id;
        return (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => data.setDomainId(d.id)}
            style={{
              fontSize: size, padding: "3px 9px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
              background: active ? palette.accentSoft : "transparent",
              border: `1px solid ${active ? palette.accent : palette.glassBorder}`,
              color: active ? palette.accent : palette.textMuted,
            }}
          >
            {d.name}
          </button>
        );
      })}
    </div>
  );
}

// ── Option: bars ─────────────────────────────────────────────────────────────

export const TOP_BAR_HEIGHT = 40;
export const BOTTOM_BAR_HEIGHT = 28;

function Bars({ palette }: { palette: OverlayPalette }) {
  const data = useEdgeData();
  const glass = {
    background: palette.glass,
    backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
  } as const;
  return (
    <>
      <div data-overlay-hit style={{
        ...glass, position: "fixed", top: 0, left: 0, right: 0, height: TOP_BAR_HEIGHT, zIndex: 90,
        display: "flex", alignItems: "center", gap: 16, padding: "0 16px",
        borderBottom: `1px solid ${palette.glassBorder}`,
      }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: palette.text }}>Khameleon</span>
        <div style={{ width: 1, height: 16, background: palette.glassBorder }} />
        <div title={SINCE} style={{ display: "flex", gap: 14 }}>
          {stats(data.telemetry).map(s => (
            <span key={s.label} style={{ fontSize: 10.5, color: palette.textMuted }}>
              {s.label} <span style={{ color: palette.text, fontWeight: 600 }}>{s.value}</span>
            </span>
          ))}
          {!data.telemetry && <span style={{ fontSize: 10.5, color: palette.textMuted }}>Usage unavailable</span>}
        </div>
        <div style={{ flex: 1 }} />
        <DomainChips palette={palette} data={data} />
      </div>
      <div data-overlay-hit style={{
        ...glass, position: "fixed", bottom: 0, left: 0, right: 0, height: BOTTOM_BAR_HEIGHT, zIndex: 90,
        display: "flex", alignItems: "center", gap: 8, padding: "0 16px",
        borderTop: `1px solid ${palette.glassBorder}`, overflow: "hidden",
      }}>
        <Radio size={11} color={palette.accent} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, color: palette.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {data.feed.length ? data.feed.slice(0, 4).map(feedLine).join("   ·   ") : "No recent activity"}
        </span>
      </div>
    </>
  );
}

// ── Option: floating icons ──────────────────────────────────────────────────

function IconPill({ palette, bare, children }: { palette: OverlayPalette; bare: boolean; children: ReactNode }) {
  return (
    <div style={bare ? { display: "flex", alignItems: "center", gap: 14, filter: BARE_SHADOW } : {
      display: "flex", alignItems: "center", gap: 14, padding: "8px 12px", borderRadius: 999,
      background: palette.glass, border: `1px solid ${palette.glassBorder}`,
      backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: palette.glassShadow,
    }}>
      {children}
    </div>
  );
}

function FloatingIcons({ palette, bare }: { palette: OverlayPalette; bare: boolean }) {
  const data = useEdgeData();
  const [hoverStat, setHoverStat] = useState<string | null>(null);
  const [domainsOpen, setDomainsOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const color = bare ? "#fff" : palette.iconColor;
  const s = stats(data.telemetry);

  return (
    <>
      <div data-overlay-hit style={{ position: "fixed", top: 14, left: 14, zIndex: 90 }}>
        <IconPill palette={palette} bare={bare}>
          {s.length === 0 && <span style={{ fontSize: 10.5, color }}>Usage unavailable</span>}
          {s.map(st => (
            <span key={st.label} className="khi-icon-btn" title={`${st.label}: ${st.value} (${SINCE.toLowerCase()})`}
              onMouseEnter={() => setHoverStat(st.label)} onMouseLeave={() => setHoverStat(null)}
              style={{ display: "flex", alignItems: "center", gap: 6, color }}>
              {st.icon}
              {hoverStat === st.label && <span style={{ fontSize: 10.5 }}>{st.value}</span>}
            </span>
          ))}
        </IconPill>
      </div>

      <div data-overlay-hit style={{ position: "fixed", top: 14, right: 14, zIndex: 90, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        <IconPill palette={palette} bare={bare}>
          <button type="button" className="khi-icon-btn" aria-label="Work domain" aria-expanded={domainsOpen}
            onClick={() => setDomainsOpen(o => !o)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", color: domainsOpen ? palette.accent : color }}>
            <Filter size={13} strokeWidth={1.5} />
          </button>
        </IconPill>
        {domainsOpen && (
          <div style={{ padding: 8, borderRadius: 12, background: palette.chatBg, border: `1px solid ${palette.chatBorder}`, backdropFilter: "blur(18px)", maxWidth: 360 }}>
            <DomainChips palette={palette} data={data} />
          </div>
        )}
      </div>

      <div data-overlay-hit style={{ position: "fixed", bottom: 14, left: 14, zIndex: 90, display: "flex", flexDirection: "column", gap: 8 }}>
        {feedOpen && (
          <div style={{ padding: "8px 10px", borderRadius: 12, background: palette.chatBg, border: `1px solid ${palette.chatBorder}`, backdropFilter: "blur(18px)", maxWidth: 380, display: "flex", flexDirection: "column", gap: 4 }}>
            {data.feed.length === 0 && <span style={{ fontSize: 11, color: palette.textMuted }}>No recent activity</span>}
            {data.feed.slice(0, 5).map(f => (
              <span key={f.id} style={{ fontSize: 11, color: palette.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{feedLine(f)}</span>
            ))}
          </div>
        )}
        <div style={{ alignSelf: "flex-start" }}>
          <IconPill palette={palette} bare={bare}>
            <button type="button" className="khi-icon-btn" aria-label="Recent activity" aria-expanded={feedOpen}
              onClick={() => setFeedOpen(o => !o)}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", color: feedOpen ? palette.accent : color }}>
              <Activity size={13} strokeWidth={1.5} />
            </button>
          </IconPill>
        </div>
      </div>
    </>
  );
}

export function EdgeChrome({ mode, palette, bare }: { mode: "none" | "bars" | "icons"; palette: OverlayPalette; bare: boolean }) {
  if (mode === "bars") return <Bars palette={palette} />;
  if (mode === "icons") return <FloatingIcons palette={palette} bare={bare} />;
  return null;
}
