import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useJarvisHealth, useJarvisTelemetry } from '@/hooks/useJarvis';
import { useJarvisStore } from '@/store/jarvisStore';

const COLORS = ['#58a6ff', '#3fb950', '#d29922', '#f85149', '#bc8cff', '#39d353'];

function fmt(v: number | undefined, d = 0, suf = '') {
  if (v === undefined) return '—';
  return v.toFixed(d) + suf;
}

// Generate 7-day mock data from agent history
function buildDailyData(agentHistory: { ts: number }[]) {
  const days: Record<string, number> = {};
  const now = Date.now();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    days[d.toLocaleDateString('en', { weekday: 'short' })] = 0;
  }
  agentHistory.forEach(ev => {
    const d = new Date(ev.ts).toLocaleDateString('en', { weekday: 'short' });
    if (d in days) days[d]++;
  });
  return Object.entries(days).map(([day, count]) => ({ day, count }));
}

function buildLatencyBuckets(telemetry: { queries: { latency_ms: number }[] } | undefined) {
  const buckets = [
    { range: '<100ms', count: 0 },
    { range: '100-300ms', count: 0 },
    { range: '300-1s', count: 0 },
    { range: '>1s', count: 0 },
  ];
  if (!telemetry) return buckets;
  for (const q of telemetry.queries) {
    const ms = q.latency_ms;
    if (ms < 100) buckets[0].count++;
    else if (ms < 300) buckets[1].count++;
    else if (ms < 1000) buckets[2].count++;
    else buckets[3].count++;
  }
  return buckets;
}

export default function Analytics() {
  const { data: health } = useJarvisHealth();
  const { data: telemetry } = useJarvisTelemetry();
  const agentHistory = useJarvisStore(s => s.agentHistory);

  const dailyData = buildDailyData(agentHistory);
  const latencyData = buildLatencyBuckets(telemetry);

  // Agent usage from history
  const agentCounts: Record<string, number> = {};
  agentHistory.forEach(ev => { agentCounts[ev.agent] = (agentCounts[ev.agent] ?? 0) + 1; });
  const agentPie = Object.entries(agentCounts).map(([name, value]) => ({ name, value }));
  const totalAgentQueries = Object.values(agentCounts).reduce((a, b) => a + b, 0);

  // Cost breakdown by agent
  const costRows = Object.entries(telemetry?.by_agent ?? {}).map(([agent, stats]) => ({
    agent, queries: stats.queries, avgCost: stats.avg_cost, totalCost: stats.total_cost,
  }));

  const statCards = [
    { label: 'TOTAL QUERIES',  value: fmt((health?.total_queries ?? 0) + agentHistory.length, 0) },
    { label: 'AVG LATENCY',    value: fmt(health?.avg_latency_ms ?? telemetry?.avg_latency_ms, 0, 'ms') },
    { label: 'TOTAL COST',     value: `$${fmt(telemetry?.cost_usd, 4)}` },
    { label: 'ENERGY',         value: fmt(telemetry?.energy_wh, 2, ' Wh') },
  ];

  const tooltipStyle = { background: '#161b22', border: '1px solid #30363d', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#e6edf3' };

  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Analytics</h1>
          <p>Efficiency metrics and usage telemetry</p>
        </div>
      </div>
      <div className="j-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Stat cards */}
        <div className="j-grid-4">
          {statCards.map(s => (
            <div key={s.label} className="j-stat-card">
              <div className="j-stat-value">{s.value}</div>
              <div className="j-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Charts row 1 */}
        <div className="j-grid-2">
          <div className="j-card">
            <div className="j-card-header">Queries Over Time — 7 days</div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#58a6ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: '#484f58' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: '#484f58' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="#58a6ff" strokeWidth={1.5} fill="url(#blueGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="j-card">
            <div className="j-card-header">Latency Distribution</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={latencyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="range" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: '#484f58' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: '#484f58' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#58a6ff" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="j-grid-2">
          <div className="j-card">
            <div className="j-card-header">Agent Usage</div>
            {agentPie.length === 0 ? (
              <div className="j-empty" style={{ padding: '24px 0' }}>No data yet</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={agentPie} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={2}>
                      {agentPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
                  {agentPie.map((a, i) => (
                    <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8b949e' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{a.name}</span>
                      <span>{a.value}</span>
                      <span style={{ color: '#484f58' }}>{totalAgentQueries > 0 ? Math.round(a.value / totalAgentQueries * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="j-card">
            <div className="j-card-header">Cost Breakdown</div>
            {costRows.length === 0 ? (
              <div className="j-empty" style={{ padding: '24px 0' }}>No cost data</div>
            ) : (
              <table className="j-table">
                <thead><tr>
                  <th>Agent</th><th>Queries</th><th>Avg cost</th><th>Total</th>
                </tr></thead>
                <tbody>
                  {costRows.map(r => (
                    <tr key={r.agent}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.agent}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.queries}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>${r.avgCost.toFixed(4)}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>${r.totalCost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p style={{ fontSize: 11, color: '#484f58', fontFamily: 'var(--font-mono)', marginTop: 12 }}>
              Local queries are $0.00 (engine cost only)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
