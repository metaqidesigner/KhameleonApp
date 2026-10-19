import { useEffect, useState } from 'react';
import { getVaultItems, type VaultItem } from '@/lib/vaultApi';
import { setSkillLogin } from '@/lib/savedLoginsApi';
import { TONES, type Tone } from '@/components/settings/ui';

/**
 * Build 7: which saved login a skill signs in with (a reference to the
 * Vault - never the password). Shared by the Overlay's Skills panel and
 * Classic's Skill Sets page.
 */
let cache: Promise<VaultItem[]> | null = null;
const logins = () => (cache ??= getVaultItems());

export function SkillLoginPicker({ tone, skillId, value, onChange }: { tone: Tone; skillId: number; value: number | null | undefined; onChange?: (v: number | null) => void }) {
  const t = TONES[tone];
  const [items, setItems] = useState<VaultItem[]>([]);
  const [current, setCurrent] = useState<number | null>(value ?? null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { logins().then(setItems).catch(() => {}); }, []);
  useEffect(() => setCurrent(value ?? null), [value]);
  if (!items.length && !current) return null;

  const change = async (v: number | null) => {
    setError(null);
    try { await setSkillLogin(skillId, v); setCurrent(v); onChange?.(v); } catch (e) { setError(e instanceof Error ? e.message : 'Couldn\'t save'); }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: t.muted, flexWrap: 'wrap' }}>
      <span>Signs in with</span>
      <select aria-label="Saved login this skill uses" value={current ?? ''} onChange={e => void change(e.target.value ? Number(e.target.value) : null)}
        style={{ fontSize: 11, padding: '2px 6px', borderRadius: t.radius, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontFamily: 'inherit' }}>
        <option value="">no saved login</option>
        {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
      {current && <span>- asks you before using it</span>}
      {error && <span style={{ color: t.bad }}>{error}</span>}
    </div>
  );
}
