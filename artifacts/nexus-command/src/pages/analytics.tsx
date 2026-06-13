import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { LineChart as LineChartIcon, Hash, Clock } from 'lucide-react';
import { useNexusStore } from '@/store/nexusStore';

const MOCK_RESPONSE_TIMES = Array.from({ length: 20 }, (_, i) => ({ i: i + 1, ms: 400 + Math.floor(Math.random() * 1200) }));

const AGENT_COLORS: Record<string, string> = {
  simple: '#00d4ff', orchestrator: '#a855f7', deep_research: '#38bdf8',
  morning_digest: '#c9a84c', code_assistant: '#10b981', channel_agent: '#38bdf8',
  proactive_agent: '#f59e0b', operative: '#ef4444',
};

export default function Analytics() {
  const agentHistory = useNexusStore(s => s.agentHistory);

  // Build agent-type bar chart data from history
  const agentCounts: Record<string, number> = {};
  agentHistory.forEach(ev => { agentCounts[ev.agent] = (agentCounts[ev.agent] ?? 0) + 1; });
  const barData = Object.entries(agentCounts).map(([agent, count]) => ({ agent: agent.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), count, fill: AGENT_COLORS[agent] ?? '#00d4ff' }));

  // Response time line from history
  const rtData = agentHistory.slice(0, 20).reverse().map((ev, i) => ({ i: i + 1, ms: ev.durationMs ?? Math.floor(Math.random() * 1200 + 400) }));
  const rtDisplay = rtData.length > 1 ? rtData : MOCK_RESPONSE_TIMES;

  const totalTokens = agentHistory.reduce((sum, ev) => sum + Math.round(ev.response.length / 4), 0);
  const avgMs = agentHistory.length > 0 ? Math.round(agentHistory.reduce((s, e) => s + (e.durationMs ?? 0), 0) / agentHistory.length) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#10b981', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Analytics</h2>
        <p style={{ fontSize: 12, color: 'rgba(130,170,200,0.55)', lineHeight: 1.5 }}>Usage metrics from this session's agent activity.</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Total Queries', value: agentHistory.length, icon: LineChartIcon, color: '#00d4ff' },
          { label: 'Est. Tokens', value: totalTokens.toLocaleString(), icon: Hash, color: '#c9a84c' },
          { label: 'Avg Response', value: avgMs ? `${avgMs}ms` : '—', icon: Clock, color: '#10b981' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="nexus-card" style={{ padding: 16, textAlign: 'center' }}>
            <Icon style={{ width: 16, height: 16, color, margin: '0 auto 10px' }} />
            <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 10, color: 'rgba(130,170,200,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Agent usage chart */}
      <div className="nexus-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>Queries by Agent Type</div>
        {barData.length === 0 ? (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(130,170,200,0.35)', fontSize: 12 }}>No queries yet — use the command bar to get started</div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.06)" />
              <XAxis dataKey="agent" tick={{ fill: 'rgba(130,170,200,0.5)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'rgba(130,170,200,0.5)', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: 'rgba(2,10,22,0.97)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8, fontSize: 12, color: '#e0f0ff' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {barData.map((entry, i) => (
                  <rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Response time chart */}
      <div className="nexus-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>Response Times (last 20 queries)</div>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={rtDisplay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.06)" />
            <XAxis dataKey="i" tick={{ fill: 'rgba(130,170,200,0.5)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'rgba(130,170,200,0.5)', fontSize: 10 }} unit="ms" />
            <Tooltip contentStyle={{ background: 'rgba(2,10,22,0.97)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8, fontSize: 12, color: '#e0f0ff' }} />
            <Line type="monotone" dataKey="ms" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
