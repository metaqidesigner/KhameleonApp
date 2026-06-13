import React, { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { useJarvisStore } from '@/store/jarvisStore';
import { getHealth } from '@/lib/jarvisApi';

type Section = 'GENERAL'|'ENGINE'|'APPEARANCE'|'MEMORY'|'TELEMETRY'|'ADVANCED';
const SECTIONS: Section[] = ['GENERAL','ENGINE','APPEARANCE','MEMORY','TELEMETRY','ADVANCED'];

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontFamily:'var(--j-font-ui)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'var(--j-text-muted)', display:'block', marginBottom:4 }}>{children}</label>;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom:16 }}>{children}</div>;
}

function Toggle({ value, onChange }: { value:boolean; onChange:(v:boolean)=>void }) {
  return (
    <button onClick={() => onChange(!value)} style={{ width:40, height:20, background: value ? 'rgba(0,212,255,0.2)' : 'rgba(0,0,0,0.5)', border:`1px solid ${value ? 'var(--j-cyan)' : 'rgba(0,212,255,0.2)'}`, cursor:'pointer', position:'relative', flexShrink:0 }}>
      <span style={{ position:'absolute', top:3, left: value ? 22 : 3, width:12, height:12, background: value ? 'var(--j-cyan)' : 'var(--j-text-faint)', transition:'left 0.15s' }} />
    </button>
  );
}

function EngineSection({ health }: { health: string }) {
  const [result, setResult] = useState<string|null>(null);
  const test = async () => {
    const h = await getHealth();
    setResult(h.status === 'offline' ? '✕ OFFLINE — Check engine configuration' : `● CONNECTED — ${h.engine} · ${h.model}`);
  };
  return (
    <>
      <Row>
        <Label>ENGINE</Label>
        <select className="j-input" defaultValue="ollama">
          {['ollama','vllm','sglang','llama.cpp','openai','anthropic'].map(e => (
            <option key={e} value={e} style={{ background:'#020c14' }}>{e.toUpperCase()}</option>
          ))}
        </select>
      </Row>
      <Row>
        <Label>MODEL</Label>
        <input className="j-input" defaultValue="llama3.2" />
      </Row>
      <Row>
        <Label>BASE URL</Label>
        <input className="j-input" defaultValue="http://localhost:11434" />
      </Row>
      <button className="j-btn-primary" style={{ height:36, padding:'0 16px', fontSize:11 }} onClick={test}>
        ▶ TEST CONNECTION
      </button>
      {result && (
        <div style={{ marginTop:10, fontFamily:'var(--j-font-mono)', fontSize:11, color: result.startsWith('●') ? 'var(--j-green)' : 'var(--j-red)', animation:'jarvis-fadein 0.2s ease both' }}>{result}</div>
      )}
    </>
  );
}

function AppearanceSection() {
  const { scanLinesEnabled, setScanLines, cornerBracketsEnabled, setCornerBrackets, tickerSpeed, setTickerSpeed } = useJarvisStore();
  return (
    <>
      <Row>
        <Label>THEME</Label>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'rgba(0,4,8,0.6)', border:'1px solid rgba(0,212,255,0.15)' }}>
          <span style={{ fontFamily:'var(--j-font-ui)', fontSize:12, color:'var(--j-text-muted)' }}>JARVIS REQUIRES DARK MODE</span>
          <Toggle value={true} onChange={() => {}} />
        </div>
      </Row>
      <Row>
        <Label>FONT SIZE</Label>
        <div style={{ display:'flex', gap:8 }}>
          {[12,13,14].map(s => (
            <label key={s} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontFamily:'var(--j-font-ui)', fontSize:12, color:'var(--j-text-muted)' }}>
              <input type="radio" name="fontsize" defaultChecked={s===13} style={{ accentColor:'var(--j-cyan)' }}/> {s}px
            </label>
          ))}
        </div>
      </Row>
      <Row>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Label>SCAN LINES</Label>
          <Toggle value={scanLinesEnabled} onChange={setScanLines} />
        </div>
      </Row>
      <Row>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Label>PANEL CORNERS</Label>
          <Toggle value={cornerBracketsEnabled} onChange={setCornerBrackets} />
        </div>
      </Row>
      <Row>
        <Label>TICKER SPEED — {tickerSpeed}s</Label>
        <input type="range" min={30} max={120} value={tickerSpeed} onChange={e => setTickerSpeed(Number(e.target.value))} style={{ width:'100%', accentColor:'var(--j-cyan)' }} />
        <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--j-font-mono)', fontSize:9, color:'var(--j-text-faint)', marginTop:2 }}>
          <span>30s (FAST)</span><span>120s (SLOW)</span>
        </div>
      </Row>
    </>
  );
}

function GenericSection({ section }: { section:Section }) {
  const fields: Record<string, string[][]> = {
    GENERAL: [['WORKSPACE NAME','My JARVIS'], ['DEFAULT AGENT','simple'], ['LANGUAGE','en']],
    MEMORY: [['MAX CHUNKS','10000'], ['CHUNK SIZE','512'], ['OVERLAP','50']],
    TELEMETRY: [['RETENTION DAYS','30'], ['EXPORT FORMAT','json']],
    ADVANCED: [['API TIMEOUT (ms)','30000'], ['STREAM BUFFER','2048'], ['LOG LEVEL','info']],
  };
  const rows = fields[section] ?? [];
  return (
    <>
      {rows.map(([label, def]) => (
        <Row key={label}>
          <Label>{label}</Label>
          <input className="j-input" defaultValue={def} />
        </Row>
      ))}
    </>
  );
}

export default function Settings() {
  const [active, setActive] = useState<Section>('GENERAL');
  const { data: health } = { data: undefined } as { data?: { engine?: string } };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'30% 70%', gap:6, height:'100%', padding:8 }}>
      {/* Nav */}
      <JPanel title="CONFIGURATION MENU" icon={<SettingsIcon size={13}/>}>
        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          {SECTIONS.map(s => (
            <button
              key={s}
              onClick={() => setActive(s)}
              style={{
                display:'flex', alignItems:'center', height:40,
                padding:'0 12px',
                background: active === s ? 'rgba(0,212,255,0.06)' : 'transparent',
                border:'none',
                borderLeft: `3px solid ${active === s ? 'var(--j-cyan)' : 'transparent'}`,
                color: active === s ? 'var(--j-cyan)' : 'var(--j-text-muted)',
                fontFamily:'var(--j-font-ui)', fontSize:12, fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.1em',
                cursor:'pointer', width:'100%', textAlign:'left',
                transition:'color 0.15s, background 0.15s',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </JPanel>

      {/* Content */}
      <JPanel title={`SETTINGS — ${active}`} icon={<SettingsIcon size={13}/>}>
        <div style={{ maxWidth:480 }}>
          {active === 'ENGINE'     && <EngineSection health={health?.engine ?? ''} />}
          {active === 'APPEARANCE' && <AppearanceSection />}
          {(active !== 'ENGINE' && active !== 'APPEARANCE') && <GenericSection section={active} />}
        </div>
      </JPanel>
    </div>
  );
}
