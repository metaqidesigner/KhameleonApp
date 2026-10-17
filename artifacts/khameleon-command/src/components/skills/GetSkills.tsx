import { useCallback, useEffect, useState } from 'react';
import { getSkillSources, addSkillSource, removeSkillSource, browseSkills, previewSkill, updateSkillFromGithub, type SkillSource, type RemoteSkill, type RemoteSkillPreview } from '@/lib/skillSourcesApi';

/**
 * Get skills (docs/build-review.md, Build 16): browse followed GitHub
 * sources or paste any GitHub link, preview a skill in full, and install it.
 * Installing always goes through the full-content confirm gate (the parent's
 * useSkillLibrary). Restricted-licence skills can't be installed; programs
 * inside a skill are never run. Shared by the Overlay's Skills panel and
 * Classic's Skill Sets page.
 */

type Tone = 'overlay' | 'classic';

const TONES: Record<Tone, { text: string; muted: string; card: string; border: string; accent: string; good: string; warn: string; bad: string; input: string; radius: number }> = {
  overlay: { text: '#d6efee', muted: '#8fb4b6', card: 'rgba(255,255,255,0.035)', border: 'rgba(255,255,255,0.1)', accent: '#6FE6BD', good: '#6FE6BD', warn: '#ffb36b', bad: '#ff9b9b', input: 'rgba(0,0,0,0.25)', radius: 10 },
  classic: { text: 'var(--j-text)', muted: 'var(--j-text-muted)', card: 'rgba(0,212,255,0.03)', border: 'rgba(0,212,255,0.12)', accent: 'var(--j-cyan)', good: 'var(--j-green)', warn: 'var(--j-amber)', bad: 'var(--j-red)', input: 'rgba(0,4,8,0.6)', radius: 2 },
};

export function GetSkills({ tone, onInstall }: { tone: Tone; onInstall: (url: string) => Promise<void> }) {
  const t = TONES[tone];
  const [sources, setSources] = useState<SkillSource[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [skills, setSkills] = useState<RemoteSkill[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [newSource, setNewSource] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState<RemoteSkillPreview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewingUpdate, setReviewingUpdate] = useState<string | null>(null);

  const browse = useCallback(async (url: string) => {
    setCurrent(url);
    setSkills(null);
    setOpen(null);
    setError(null);
    setLoading(true);
    try { setSkills(await browseSkills(url)); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    getSkillSources().then(s => { setSources(s); if (s[0]) void browse(s[0].url); }).catch(e => setError(e instanceof Error ? e.message : 'Something went wrong'));
  }, [browse]);

  const toggle = async (s: RemoteSkill) => {
    if (open === s.url) { setOpen(null); return; }
    setOpen(s.url);
    setPreview(null);
    try { setPreview(await previewSkill(s.url)); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
  };

  /** Shows the creator's new version; "Apply update" replaces the installed one. */
  const reviewUpdate = async (s: RemoteSkill) => {
    setReviewingUpdate(s.url);
    if (open !== s.url) await toggle(s);
  };
  const applyUpdate = async (s: RemoteSkill) => {
    setBusy(s.url);
    setError(null);
    try { await updateSkillFromGithub(s.url); setReviewingUpdate(null); if (current) await browse(current); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    setBusy(null);
  };

  const install = async (s: RemoteSkill) => {
    setBusy(s.url);
    await onInstall(s.url);
    if (current) await browse(current);
    setBusy(null);
  };

  const input: React.CSSProperties = { flex: 1, minWidth: 0, padding: '6px 9px', borderRadius: t.radius, fontSize: 12, fontFamily: 'inherit', background: t.input, border: `1px solid ${t.border}`, color: t.text };
  const btn = (primary?: boolean): React.CSSProperties => ({
    padding: '5px 10px', borderRadius: t.radius, fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
    background: primary ? 'rgba(111,230,189,0.14)' : 'transparent', border: `1px solid ${primary ? t.accent : t.border}`, color: t.text,
  });
  const chip = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: tone === 'classic' ? 2 : 999, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
    background: active ? 'rgba(111,230,189,0.12)' : 'transparent', border: `1px solid ${active ? t.accent : t.border}`, color: active ? t.accent : t.muted,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: t.text }}>
      <div style={{ fontSize: 11.5, color: t.muted, lineHeight: 1.45 }}>
        Install skills that creators publish on GitHub. You'll see each skill in full before it's added.
      </div>

      <form onSubmit={e => { e.preventDefault(); if (link.trim()) void browse(link.trim()); }} style={{ display: 'flex', gap: 6 }}>
        <input aria-label="GitHub link" placeholder="Paste a GitHub link to a skill or collection" value={link} onChange={e => setLink(e.target.value)} style={input} />
        <button type="submit" style={btn(true)} disabled={!link.trim()}>Look</button>
      </form>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: t.muted }}>Sources:</span>
        {sources.map(s => (
          <span key={s.url} style={chip(current === s.url)}>
            <button type="button" onClick={() => void browse(s.url)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}>{s.label}</button>
            <button type="button" aria-label={`Stop following ${s.label}`} onClick={() => void removeSkillSource(s.url).then(setSources)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: t.muted, font: 'inherit' }}>×</button>
          </span>
        ))}
      </div>
      <form onSubmit={e => { e.preventDefault(); if (newSource.trim()) void addSkillSource(newSource.trim()).then(s => { setSources(s); setNewSource(''); }).catch(err => setError(err.message)); }} style={{ display: 'flex', gap: 6 }}>
        <input aria-label="Add a source" placeholder="Follow another GitHub collection (link)" value={newSource} onChange={e => setNewSource(e.target.value)} style={input} />
        <button type="submit" style={btn()} disabled={!newSource.trim()}>Follow</button>
      </form>

      {error && <div role="alert" style={{ fontSize: 12, color: t.bad }}>{error}</div>}
      {loading && <div style={{ fontSize: 12, color: t.muted }}>Looking on GitHub…</div>}
      {skills && skills.length === 0 && <div style={{ fontSize: 12, color: t.muted }}>No skills found at that link.</div>}

      {skills?.map(s => {
        const restricted = s.licence.kind === 'restricted';
        const licenceColour = s.licence.kind === 'open' ? t.good : restricted ? t.bad : t.warn;
        return (
          <div key={s.url} style={{ padding: '9px 10px', borderRadius: t.radius, background: t.card, border: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void toggle(s)} aria-expanded={open === s.url}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: t.text, textAlign: 'left' }}>
                {s.name}
              </button>
              <span style={{ fontSize: 10.5, color: licenceColour }}>{s.licence.label}</span>
              <span style={{ fontSize: 10.5, color: t.muted }}>by {s.author}</span>
            </div>
            {s.description && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: open === s.url ? 'unset' : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.description}</div>}
            {s.programs > 0 && (
              <div style={{ fontSize: 11, color: t.warn, marginTop: 4 }}>
                Includes {s.programs} program{s.programs === 1 ? '' : 's'} Khameleon won't run - this skill may only partly work.
              </div>
            )}
            {s.licence.kind === 'unknown' && <div style={{ fontSize: 11, color: t.warn, marginTop: 4 }}>No licence stated - check you're allowed to use it at work.</div>}

            {open === s.url && (
              <div style={{ marginTop: 8, padding: '8px 9px', borderRadius: t.radius, background: t.input, maxHeight: 220, overflowY: 'auto', fontSize: 11.5, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                {preview?.url === s.url ? preview.content : 'Loading the full skill…'}
                {preview?.url === s.url && preview.truncated && <div style={{ color: t.warn, marginTop: 6 }}>This skill is long, so it was shortened to fit.</div>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
              {s.installedStatus === 'installed' && !s.updateAvailable && <span style={{ fontSize: 11.5, color: t.good }}>Installed</span>}
              {s.installedStatus === 'pending' && <span style={{ fontSize: 11.5, color: t.warn }}>Waiting for your confirmation in My skills</span>}
              {s.updateAvailable && reviewingUpdate !== s.url && (
                <>
                  <span style={{ fontSize: 11.5, color: t.warn }}>The creator has updated this skill</span>
                  <button type="button" style={btn(true)} onClick={() => void reviewUpdate(s)}>Review update</button>
                </>
              )}
              {s.updateAvailable && reviewingUpdate === s.url && (
                <>
                  <span style={{ fontSize: 11.5, color: t.muted }}>The new version is shown above.</span>
                  <button type="button" style={btn(true)} disabled={busy === s.url} onClick={() => void applyUpdate(s)}>{busy === s.url ? 'Updating…' : 'Apply update'}</button>
                  <button type="button" style={btn()} onClick={() => setReviewingUpdate(null)}>Not now</button>
                </>
              )}
              {!s.installedStatus && (restricted
                ? <span style={{ fontSize: 11.5, color: t.bad }}>Can't be installed - restricted licence</span>
                : <button type="button" style={btn(true)} disabled={busy === s.url} onClick={() => void install(s)}>{busy === s.url ? 'Installing…' : 'Install…'}</button>)}
              <button type="button" style={btn()} onClick={() => void toggle(s)}>{open === s.url ? 'Hide' : 'Preview'}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
