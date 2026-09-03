import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LineChart, Line,
} from 'recharts';
import { BarChart2 } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { useJarvisTelemetry } from '@/hooks/useJarvis';
import { MOCK_TELEMETRY } from '@/lib/jarvisApi';

const CHART_STYLE = {
  background:'transparent',
  cartesianGrid: 'rgba(0,212,255,0.08)',
  tick: { fontFamily:'var(--j-font-ui)', fontSize:9, fill:'var(--j-text-muted)' },
};

const TT = ({ active, payload }: { active?:boolean; payload?:{name?:string; value?:number}[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'rgba(0,4,12,0.97)', border:'1px solid rgba(0,212,255,0.3)', padding:'5px 10px', fontFamily:'var(--j-font-ui)', fontSize:10, color:'var(--j-text)' }}>
      {payload.map(p => <div key={p.name}>{p.name}: {p.value}</div>)}
    </div>
  );
};

/** Nearest-rank 95th percentile over a set of latencies. Returns undefined
 * when there's nothing to compute from (rather than faking a number). */
function p95(latencies: number[]): number | undefined {
  if (!latencies.length) return undefined;
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[idx];
}

export default function Analytics() {
  const { data: telemetry = MOCK_TELEMETRY } = useJarvisTelemetry();

  // Build the 14-day query-volume / cost chart from telemetry.queries (real,
  // timestamped query records already being fetched below) instead of
  // Math.random() - the chart previously re-rolled fake numbers on every
  // single render, changing every time regardless of any real activity.
  const areaData = (() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i));
      return d;
    });
    const buckets = days.map(d => ({
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dayStart: d.getTime(),
      queries: 0,
      cost: 0,
    }));
    for (const q of telemetry.queries) {
      const bucket = buckets.find((b, i) => q.ts >= b.dayStart && (i === buckets.length - 1 || q.ts < buckets[i + 1].dayStart));
      if (bucket) { bucket.queries += 1; bucket.cost += q.cost_usd; }
    }
    return buckets.map(({ label, queries, cost }) => ({ label, queries, cost: +cost.toFixed(4) }));
  })();

  // Latency buckets, counted from real query records rather than hardcoded.
  const latData = (() => {
    const bounds: { label: string; color: string; max: number }[] = [
      { label: '<100ms',    color: '#3fb950', max: 100 },
      { label: '100-300ms', color: '#00d4ff', max: 300 },
      { label: '300ms-1s',  color: '#c9a84c', max: 1000 },
      { label: '>1s',       color: '#c0152a', max: Infinity },
    ];
    const counts = bounds.map(b => ({ ...b, count: 0 }));
    for (const q of telemetry.queries) {
      const b = counts.find(c => q.latency_ms < c.max);
      if (b) b.count += 1;
    }
    return counts;
  })();

  const agents = Object.entries(telemetry.by_agent);
  // Per-agent p95 computed from the same real query records - the backend
  // doesn't track p95 per agent, and this used to fill that gap with
  // avg_latency * 1.8, an unlabeled guess presented as a real percentile.
  const p95ByAgent: Record<string, number | undefined> = {};
  for (const [agentId] of agents) {
    p95ByAgent[agentId] = p95(telemetry.queries.filter(q => q.agent === agentId).map(q => q.latency_ms));
  }
  const tableRows = agents as [string, { queries:number; avg_latency:number; avg_tokens:number; avg_cost:number; total_cost:number }][];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, height:'100%', padding:8 }}>
      {/* Top row: 2 charts */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, flex:'0 0 260px' }}>
        <JPanel title="QUERY VOLUME" icon={<BarChart2 size={13}/>} badge="14 DAY">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={areaData} margin={{ top:4, right:4, left:-20, bottom:4 }}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#00d4ff" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART_STYLE.cartesianGrid} vertical={false} />
              <XAxis dataKey="label" tick={CHART_STYLE.tick} interval={3} />
              <YAxis tick={CHART_STYLE.tick} />
              <Tooltip content={<TT />} />
              <Area type="monotone" dataKey="queries" stroke="#00d4ff" strokeWidth={1.5} fill="url(#areaFill)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </JPanel>

        <JPanel title="LATENCY DISTRIBUTION" icon={<BarChart2 size={13}/>}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={latData} margin={{ top:4, right:4, left:-20, bottom:4 }}>
              <CartesianGrid stroke={CHART_STYLE.cartesianGrid} vertical={false} />
              <XAxis dataKey="label" tick={CHART_STYLE.tick} />
              <YAxis tick={CHART_STYLE.tick} />
              <Tooltip content={<TT />} />
              <Bar dataKey="count" radius={[2,2,0,0]}>
                {latData.map(d => (
                  <Cell key={d.label} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </JPanel>
      </div>

      {/* Bottom: full-width performance matrix */}
      <div style={{ flex:1, minHeight:0 }}>
        <JPanel title="AGENT PERFORMANCE MATRIX" icon={<BarChart2 size={13}/>} badge="ALL TIME">
          <div style={{ overflowX:'auto' }}>
            <table className="j-table" style={{ minWidth:700 }}>
              <thead className="j-table-header">
                <tr>
                  <th>AGENT</th><th>QUERIES</th><th>AVG LATENCY</th><th>P95 LATENCY</th><th>AVG TOKENS</th><th>COST/QUERY</th><th>TOTAL COST</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr><td colSpan={7} className="j-empty" style={{ padding: '20px 0' }}>NO QUERIES YET</td></tr>
                ) : tableRows.map(([agent, st]) => {
                  const p = p95ByAgent[agent];
                  return (
                    <tr key={agent}>
                      <td style={{ fontFamily:'var(--j-font-ui)', fontSize:11 }}>{String(agent).replace('_',' ').toUpperCase()}</td>
                      <td className="j-mono">{st.queries}</td>
                      <td className="j-mono">{st.avg_latency.toFixed(0)}ms</td>
                      <td className="j-mono">{p != null ? `${p.toFixed(0)}ms` : '—'}</td>
                      <td className="j-mono">{st.avg_tokens.toFixed(0)}</td>
                      <td className="j-mono">${st.avg_cost.toFixed(5)}</td>
                      <td className="j-mono">${st.total_cost.toFixed(4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mini charts */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:12 }}>
            {['Cost over time','Energy over time'].map(label => (
              <div key={label}>
                <div style={{ fontFamily:'var(--j-font-ui)', fontSize:10, color:'var(--j-text-muted)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:4 }}>{label}</div>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={areaData} margin={{ top:2, right:4, left:-20, bottom:2 }}>
                    <CartesianGrid stroke="rgba(0,212,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ ...CHART_STYLE.tick, fontSize:8 }} interval={4} />
                    <YAxis tick={{ ...CHART_STYLE.tick, fontSize:8 }} />
                    <Tooltip content={<TT />} />
                    <Line type="monotone" dataKey="cost" stroke={label.includes('Energy') ? '#c9a84c' : '#00d4ff'} strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </JPanel>
      </div>
    </div>
  );
}
