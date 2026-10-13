import { useEffect, useState } from "react";
import { ActivityLog } from "@/components/activity/ActivityLog";
import { getRoster, getAgentStatus, type AgentConfig } from "@/lib/agentsApi";
import type { JarvisTelemetry } from "@/lib/jarvisApi";
import { TEXT, MUTED } from "./ui";

/**
 * Workspace -> Status (gap review Q2, Q10, Q14): usage so far, which models
 * are switched on, and the one activity log. Every figure comes straight
 * from the server - if it can't be reached, it says so instead of showing
 * stand-in numbers. Energy is labelled as the estimate it is.
 */

const BASE = import.meta.env.VITE_API_URL || "/api";

interface Health { uptime: number }

function useStatusData() {
  const [telemetry, setTelemetry] = useState<JarvisTelemetry | null | "unreachable">(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [ready, setReady] = useState<Set<string> | null>(null);
  useEffect(() => {
    const load = () => {
      fetch(`${BASE}/telemetry`).then(r => (r.ok ? r.json() : Promise.reject())).then(setTelemetry).catch(() => setTelemetry("unreachable"));
      fetch(`${BASE}/health`).then(r => (r.ok ? r.json() : Promise.reject())).then(setHealth).catch(() => setHealth(null));
    };
    load();
    getRoster().then(async roster => {
      setAgents(roster);
      // "Ready" = the server says this agent can actually answer (it has a key).
      const statuses = await Promise.all(roster.filter(a => a.enabled).map(a => getAgentStatus(a.id)));
      setReady(new Set(statuses.filter(st => st.status === "online").map(st => st.agentId)));
    }).catch(() => {});
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
  }, []);
  return { telemetry, health, agents, ready };
}

function uptimeText(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div title={hint} style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.035)" }}>
      <div style={{ fontSize: 10.5, color: MUTED }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: TEXT, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{value}</div>
    </div>
  );
}

export function StatusTab() {
  const { telemetry, health, agents, ready } = useStatusData();
  const t = telemetry && telemetry !== "unreachable" ? telemetry : null;
  const enabled = agents.filter(a => a.enabled);
  const readyAgents = ready ? enabled.filter(a => ready.has(a.id)) : [];
  const notReady = ready ? enabled.length - readyAgents.length : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section aria-label="Usage" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: TEXT }}>
          Usage {health ? <span style={{ fontWeight: 400, color: MUTED }}>· since the server started {uptimeText(health.uptime)} ago</span> : null}
        </div>
        {telemetry === "unreachable" && <div style={{ fontSize: 12, color: "#ffb0b0" }}>Can't reach Khameleon's server, so there are no figures to show.</div>}
        {telemetry === null && <div style={{ fontSize: 12, color: MUTED }}>Loading…</div>}
        {t && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <Figure label="Questions answered" value={String(t.total_queries)} />
            <Figure label="Average response" value={t.avg_latency_ms ? `${(t.avg_latency_ms / 1000).toFixed(1)} s` : "–"} />
            <Figure label="Cost" value={`$${t.cost_usd.toFixed(2)}`} />
            <Figure label="Energy (estimate)" value={`≈ ${t.energy_wh.toFixed(2)} Wh`}
              hint="Worked out from the number of words processed, not measured. Treat it as a rough guide." />
          </div>
        )}
        {ready && (
          <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
            {readyAgents.length
              ? <>Ready to answer: {readyAgents.map(a => `${a.name} (${a.model})`).join(", ")}.</>
              : "No agent is ready to answer - add an API key in Settings."}
            {notReady > 0 && <> {notReady} more need an API key.</>}
          </div>
        )}
      </section>

      <section aria-label="Activity" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: TEXT }}>Activity</div>
        <ActivityLog tone="overlay" />
      </section>
    </div>
  );
}
