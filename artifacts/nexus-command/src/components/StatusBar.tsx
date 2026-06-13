import { useJarvisHealth, useJarvisTelemetry } from '@/hooks/useJarvis';
import { useJarvisStore } from '@/store/jarvisStore';

function fmt(v: number | undefined, decimals = 0, suffix = ''): string {
  if (v === undefined || v === null || isNaN(v)) return '—';
  return v.toFixed(decimals) + suffix;
}

function fmtUptime(seconds: number): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Sep() {
  return <span style={{ color: '#30363d', userSelect: 'none' }}>|</span>;
}

export function StatusBar() {
  const { data: health } = useJarvisHealth();
  const { data: telemetry } = useJarvisTelemetry();
  const agentHistory = useJarvisStore(s => s.agentHistory);

  const isOnline = health?.status === 'online';
  const isDegraded = health?.status === 'degraded';
  const statusColor = isOnline ? '#3fb950' : isDegraded ? '#d29922' : '#f85149';

  const lastEvent = agentHistory[0];

  return (
    <div style={{
      height: 28,
      background: '#161b22',
      borderTop: '1px solid #30363d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      gap: 16,
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Left — engine · model | gpu | uptime */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: '#8b949e', whiteSpace: 'nowrap',
      }}>
        <span style={{ color: statusColor }}>●</span>
        <span>{health?.engine && health.engine !== 'none' ? health.engine : 'offline'}</span>
        {health?.model && health.model !== '—' && (
          <><span style={{ color: '#484f58' }}>·</span><span>{health.model}</span></>
        )}
        {(health?.gpu || health?.vram_gb) && (
          <>
            <Sep />
            <span>
              {health.gpu ?? '—'}
              {health.vram_gb ? ` · ${health.vram_gb}GB` : ''}
            </span>
          </>
        )}
        {health?.uptime ? (
          <>
            <Sep />
            <span>↑ {fmtUptime(health.uptime)}</span>
          </>
        ) : null}
      </div>

      {/* Center — last latency · tok/s · last cost */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: '#8b949e', whiteSpace: 'nowrap',
      }}>
        <span>⚡ {lastEvent?.durationMs ? `${lastEvent.durationMs}ms` : fmt(health?.avg_latency_ms, 0, 'ms')}</span>
        {health?.tokens_per_sec !== undefined && (
          <>
            <Sep />
            <span>∿ {fmt(health.tokens_per_sec, 1, ' tok/s')}</span>
          </>
        )}
        {health?.watt_per_query !== undefined && (
          <>
            <Sep />
            <span>$ {fmt(health.total_cost_usd, 4)}</span>
          </>
        )}
      </div>

      {/* Right — total queries · energy · total cost · chunks */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: '#8b949e', whiteSpace: 'nowrap',
      }}>
        <span>◈ {agentHistory.length + (health?.total_queries ?? 0)} queries</span>
        {telemetry?.energy_wh !== undefined && (
          <>
            <Sep />
            <span>⚡ {fmt(telemetry.energy_wh, 2, ' Wh')}</span>
          </>
        )}
        {telemetry?.cost_usd !== undefined && (
          <>
            <Sep />
            <span>$ {fmt(telemetry.cost_usd, 4)}</span>
          </>
        )}
        {telemetry?.memory_chunks !== undefined && (
          <>
            <Sep />
            <span>⬡ {telemetry.memory_chunks > 1000
              ? `${(telemetry.memory_chunks / 1000).toFixed(1)}k`
              : telemetry.memory_chunks} chunks</span>
          </>
        )}
      </div>
    </div>
  );
}
