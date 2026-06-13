import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Bot, Play } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { useJarvisTelemetry } from '@/hooks/useJarvis';
import { useJarvisStore, type AgentType } from '@/store/jarvisStore';
import { MOCK_TELEMETRY } from '@/lib/jarvisApi';

const AGENT_LIST: { id: AgentType; desc: string }[] = [
  { id:'simple',          desc:'Single-turn reasoning with tool use' },
  { id:'orchestrator',    desc:'Multi-step planning and task delegation' },
  { id:'deep_research',   desc:'Extended research with web retrieval' },
  { id:'morning_digest',  desc:'Overnight summary and briefing' },
  { id:'code_assistant',  desc:'Code review, generation, debugging' },
  { id:'channel_agent',   desc:'Messaging channel monitor and responder' },
  { id:'proactive_agent', desc:'Background monitor with scheduled alerts' },
  { id:'operative',       desc:'Autonomous multi-tool task execution' },
];

const AGENT_COLORS: Record<string, string> = {
  simple:'#00d4ff', orchestrator:'#c9a84c', deep_research:'#c0152a',
  morning_digest:'#3fb950', code_assistant:'#a78bfa', channel_agent:'#f97316',
  proactive_agent:'#14b8a6', operative:'#ec4899',
};

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: {name:string; value:number}[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'rgba(0,4,12,0.97)', border:'1px solid rgba(0,212,255,0.3)', padding:'6px 10px', fontFamily:'var(--j-font-mono)', fontSize:10, color:'var(--j-text)' }}>
      {payload[0].name}: {payload[0].value}
    </div>
  );
};

export default function Agents() {
  const { data: telemetry = MOCK_TELEMETRY } = useJarvisTelemetry();
  const { setSelectedAgent, setChatOpen } = useJarvisStore();

  const chartData = AGENT_LIST.map(a => ({
    name: a.id,
    queries: telemetry.by_agent[a.id]?.queries ?? 0,
  }));

  const tableData = AGENT_LIST.map(a => {
    const s = telemetry.by_agent[a.id];
    return { id: a.id, queries: s?.queries ?? 0, avgLat: s?.avg_latency ?? 0, avgTok: s?.avg_tokens ?? 0, cost: s?.total_cost ?? 0 };
  });

  return (
    <div style={{ display:'grid', gridTemplateColumns:'40% 60%', gap:6, height:'100%', padding:8 }}>
      {/* AGENT REGISTRY */}
      <JPanel title="AGENT REGISTRY" icon={<Bot size={13}/>}>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {AGENT_LIST.map(a => (
            <div key={a.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', background:'rgba(0,212,255,0.02)', border:'1px solid rgba(0,212,255,0.08)', gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
                <Bot size={16} color={AGENT_COLORS[a.id]} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:'var(--j-font-head)', fontSize:11, color:'var(--j-text)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{a.id.replace('_',' ')}</div>
                  <div style={{ fontFamily:'var(--j-font-ui)', fontSize:11, color:'var(--j-text-muted)', marginTop:2 }}>{a.desc}</div>
                </div>
              </div>
              <button
                className="j-btn-ghost"
                style={{ height:26, padding:'0 10px', fontSize:10, flexShrink:0 }}
                onClick={() => { setSelectedAgent(a.id); setChatOpen(true); }}
              >
                <Play size={10}/>LAUNCH
              </button>
            </div>
          ))}
        </div>
      </JPanel>

      {/* AGENT TELEMETRY */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <JPanel title="AGENT TELEMETRY" icon={<Bot size={13}/>} badge="7 DAY">
          <div style={{ height:200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top:4, right:8, left:-20, bottom:4 }}>
                <XAxis dataKey="name" tick={{ fontFamily:'var(--j-font-mono)', fontSize:8, fill:'var(--j-text-muted)' }} />
                <YAxis tick={{ fontFamily:'var(--j-font-mono)', fontSize:8, fill:'var(--j-text-muted)' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="queries" radius={[2,2,0,0]}>
                  {chartData.map(d => (
                    <Cell key={d.name} fill={AGENT_COLORS[d.name] ?? '#00d4ff'} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop:8, overflowX:'auto' }}>
            <table className="j-table" style={{ minWidth:500 }}>
              <thead className="j-table-header">
                <tr>
                  <th>AGENT</th><th>QUERIES</th><th>AVG LATENCY</th><th>AVG TOKENS</th><th>TOTAL COST</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily:'var(--j-font-head)', fontSize:11 }}>{r.id.replace('_',' ').toUpperCase()}</td>
                    <td className="j-mono">{r.queries}</td>
                    <td className="j-mono">{r.avgLat.toFixed(0)}ms</td>
                    <td className="j-mono">{r.avgTok.toFixed(0)}</td>
                    <td className="j-mono">${r.cost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </JPanel>
      </div>
    </div>
  );
}
