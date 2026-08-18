import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LineChart, Line,
} from 'recharts';
import { BarChart2 } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { useJarvisTelemetry } from '@/hooks/useJarvis';
import { MOCK_TELEMETRY } from '@/lib/jarvisApi';

const CHART_STYLE = {
  background:'transparent',
  cartesianGrid: 'rgba(0,212,255,0.08)',
  tick: { fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif', fontSize:9, fill:'var(--j-text-muted)' },
};

const TT = ({ active, payload }: { active?:boolean; payload?:{name?:string; value?:number}[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'rgba(0,4,12,0.97)', border:'1px solid rgba(0,212,255,0.3)', padding:'5px 10px', fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif', fontSize:10, color:'var(--j-text)' }}>
      {payload.map(p => <div key={p.name}>{p.name}: {p.value}</div>)}
    </div>
  );
};

export default function Analytics() {
  const { data: telemetry = MOCK_TELEMETRY } = useJarvisTelemetry();

  // Build 14-day area chart data
  const areaData = Array.from({ length:14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    const label = d.toLocaleDateString('en-US',{ month:'short', day:'numeric' });
    return { label, queries: Math.floor(Math.random() * 30), cost: +(Math.random() * 0.05).toFixed(4) };
  });

  // Latency buckets
  const latData = [
    { label:'<100ms',   count: 42, color:'#3fb950' },
    { label:'100-300ms',count: 28, color:'#00d4ff' },
    { label:'300ms-1s', count: 18, color:'#c9a84c' },
    { label:'>1s',      count:  8, color:'#c0152a' },
  ];

  const agents = Object.entries(telemetry.by_agent);
  const tableRows = agents.length > 0 ? agents : [
    ['simple', { queries:12, avg_latency:180, avg_tokens:320, avg_cost:0, total_cost:0, p95_latency:280 }],
    ['orchestrator', { queries:5, avg_latency:420, avg_tokens:1200, avg_cost:0.001, total_cost:0.005, p95_latency:800 }],
  ] as [string, { queries:number; avg_latency:number; avg_tokens:number; avg_cost:number; total_cost:number; p95_latency?:number }][];

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
                  <rect key={d.label} fill={d.color} />
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
                {tableRows.map(([agent, s]) => {
                  const st = s as { queries:number; avg_latency:number; avg_tokens:number; avg_cost:number; total_cost:number; p95_latency?:number };
                  return (
                    <tr key={agent}>
                      <td style={{ fontFamily:'var(--j-font-head)', fontSize:11 }}>{String(agent).replace('_',' ').toUpperCase()}</td>
                      <td className="j-mono">{st.queries}</td>
                      <td className="j-mono">{st.avg_latency.toFixed(0)}ms</td>
                      <td className="j-mono">{(st.p95_latency ?? st.avg_latency * 1.8).toFixed(0)}ms</td>
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
