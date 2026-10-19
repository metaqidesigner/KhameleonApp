import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Download, Play, Plus, X } from "lucide-react";
import { useJarvisStore } from "@/store/jarvisStore";
import { useSkillLibrary, SkillConfirmGate } from "@/components/skills/useSkillLibrary";
import { GetSkills } from "@/components/skills/GetSkills";
import { SkillGuide } from "@/components/skills/SkillGuide";
import type { CaptureDraft } from "@/components/skills/CaptureTask";
import { CheckBadge, CheckDetails, useProcedureChecks } from "@/components/procedures/ProcedureCheckView";
import { FromDocument, type DocumentDraft } from "@/components/procedures/FromDocument";
import { SkillLoginPicker } from "@/components/skills/SkillLoginPicker";
import type { ProcedureCheck } from "@/lib/proceduresApi";
import type { SkillSet, CreateSkillSetInput, SkillSetSourceType } from "@/lib/skillSetsApi";
import type { WorkDomain } from "@/lib/workDomainsApi";
import type { OverlayPalette } from "./palettes";

/**
 * The Skills panel (docs/build-review.md, Build 3 - first of the three
 * panels), opened from "My skills" on the Capture & Extract toolbar.
 * Same logic as Classic's Skills page (useSkillLibrary).
 *
 * Grouped by work domain. Procedure-comparison results arrive with the
 * capture builds (4/5) - nothing is shown for them until they're real.
 */

const TEXT = "#d6efee";
const MUTED = "#8fb4b6";

const input: React.CSSProperties = {
  width: "100%", padding: "7px 9px", borderRadius: 8, fontSize: 12.5, fontFamily: "inherit",
  background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.12)", color: TEXT,
};

function Btn({ children, onClick, primary, danger, disabled, label }: {
  children: ReactNode; onClick: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; label?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8,
        fontSize: 11.5, fontFamily: "inherit", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
        background: primary ? "rgba(111,230,189,0.16)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${primary ? "rgba(111,230,189,0.5)" : danger ? "rgba(255,120,120,0.35)" : "rgba(255,255,255,0.14)"}`,
        color: danger ? "#ffb0b0" : TEXT,
      }}>
      {children}
    </button>
  );
}

/** Local chip - the chat's chip styles only exist while the chat is open. */
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick}
      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
        background: active ? "rgba(111,230,189,0.14)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? "rgba(111,230,189,0.5)" : "rgba(255,255,255,0.12)"}`,
        color: active ? "#6FE6BD" : MUTED }}>
      {children}
    </button>
  );
}

function ConnectionBadges({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {ids.map(id => (
        <span key={id} title="Connection this skill uses"
          style={{ fontSize: 9.5, padding: "1px 7px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", color: MUTED }}>
          {id}
        </span>
      ))}
    </div>
  );
}

function SkillRow({ skill, domains, lib, onRun, check, onRechecked }: {
  skill: SkillSet;
  domains: WorkDomain[];
  lib: ReturnType<typeof useSkillLibrary>;
  onRun: (s: SkillSet) => void;
  /** Build 5: how it compares with its company procedure. */
  check?: ProcedureCheck;
  onRechecked?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(skill.content);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  useEffect(() => { if (!editing) setDraft(skill.content); }, [skill.content, editing]);

  const isInstalled = skill.status === "installed";
  return (
    <div style={{ borderRadius: 10, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 10px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
        <span style={{ marginTop: 2, color: MUTED }}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: TEXT }}>{skill.name}</span>
          {skill.description && <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 2 }}>{skill.description}</span>}
        </span>
        {skill.sourceType !== "authored" && <span style={{ fontSize: 9.5, color: MUTED, flexShrink: 0 }}>{skill.sourceType}</span>}
      </button>
      {check && skill.status !== "available" && (
        <div style={{ padding: "0 10px 8px 31px", display: "flex" }}>
          <CheckBadge tone="overlay" check={check} open={showCheck} onClick={() => setShowCheck(v => !v)} />
        </div>
      )}
      {showCheck && check && (
        <div style={{ padding: "0 10px 10px 31px" }}>
          <CheckDetails tone="overlay" skillId={skill.id} check={check} onRechecked={() => onRechecked?.()} />
        </div>
      )}

      {open && (
        <div style={{ padding: "0 10px 10px 31px", display: "flex", flexDirection: "column", gap: 8 }}>
          <ConnectionBadges ids={skill.requestedIntegrationIds} />
          {isInstalled && <SkillLoginPicker tone="overlay" skillId={skill.id} value={skill.loginVaultItemId} />}
          {editing ? (
            <textarea aria-label={`Steps for ${skill.name}`} value={draft} onChange={e => setDraft(e.target.value)} rows={8} style={{ ...input, resize: "vertical", lineHeight: 1.45 }} />
          ) : (
            <div style={{ fontSize: 11.5, color: TEXT, whiteSpace: "pre-wrap", lineHeight: 1.45, maxHeight: 180, overflowY: "auto", padding: "7px 9px", borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
              {skill.content || <span style={{ color: MUTED }}>No steps written yet.</span>}
            </div>
          )}

          {domains.length > 0 && (
            <div role="group" aria-label="Domains" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {domains.map(d => {
                const on = skill.workDomainIds.includes(d.id);
                return (
                  <button key={d.id} type="button" aria-pressed={on} onClick={() => void lib.toggleDomain(skill, d.id)}
                    style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
                      background: on ? "rgba(111,230,189,0.14)" : "transparent",
                      border: `1px solid ${on ? "rgba(111,230,189,0.5)" : "rgba(255,255,255,0.12)"}`,
                      color: on ? "#6FE6BD" : MUTED }}>
                    {d.name}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {skill.status === "available" && <Btn primary onClick={() => void lib.install(skill)}><Download size={12} />Install</Btn>}
            {skill.status === "pending" && <Btn primary onClick={() => lib.reviewPending(skill)}>Review &amp; confirm</Btn>}
            {isInstalled && !editing && <Btn primary onClick={() => onRun(skill)}><Play size={12} />Run</Btn>}
            {isInstalled && !editing && <Btn onClick={() => setEditing(true)}>Edit steps</Btn>}
            {editing && <Btn primary disabled={draft === skill.content} onClick={() => { void lib.saveSteps(skill, draft); setEditing(false); }}>Save</Btn>}
            {editing && <Btn onClick={() => setEditing(false)}>Cancel</Btn>}
            {isInstalled && !editing && !confirmRemove && <Btn danger onClick={() => setConfirmRemove(true)}>Remove</Btn>}
            {confirmRemove && (
              <>
                <span style={{ fontSize: 11.5, color: TEXT, alignSelf: "center" }}>Remove this skill?</span>
                <Btn danger onClick={() => { void lib.remove(skill); setConfirmRemove(false); }}>Remove</Btn>
                <Btn onClick={() => setConfirmRemove(false)}>Keep</Btn>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const BLANK: CreateSkillSetInput = { name: "", description: "", content: "", sourceType: "authored", requestedTools: [], requestedIntegrationIds: [] };

function NewSkillForm({ onCreate, onClose }: { onCreate: (i: CreateSkillSetInput) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<CreateSkillSetInput>(BLANK);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<CreateSkillSetInput>) => setForm(f => ({ ...f, ...patch }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(111,230,189,0.2)" }}>
      <div role="radiogroup" aria-label="New skill source" style={{ display: "flex", gap: 6 }}>
        {[{ v: false, l: "Write one" }, { v: true, l: "Paste one from elsewhere" }].map(o => (
          <Chip key={o.l} active={importing === o.v}
            onClick={() => { setImporting(o.v); set({ sourceType: o.v ? "github" : "authored" }); }}>{o.l}</Chip>
        ))}
      </div>
      <input aria-label="Skill name" placeholder="Name (e.g. Monthly reconciliation)" value={form.name} onChange={e => set({ name: e.target.value })} style={input} />
      <input aria-label="Short description" placeholder="Short description" value={form.description} onChange={e => set({ description: e.target.value })} style={input} />
      {importing && (
        <>
          <select aria-label="Imported from" value={form.sourceType} onChange={e => set({ sourceType: e.target.value as SkillSetSourceType })} style={input}>
            <option value="github">GitHub</option>
            <option value="url">Web address</option>
            <option value="marketplace">Marketplace</option>
          </select>
          <input aria-label="Source address" placeholder="Where it came from (address)" value={form.sourceUrl ?? ""} onChange={e => set({ sourceUrl: e.target.value })} style={input} />
          <input aria-label="Author" placeholder="Author (optional)" value={form.sourceAuthor ?? ""} onChange={e => set({ sourceAuthor: e.target.value })} style={input} />
        </>
      )}
      <textarea aria-label="Steps" placeholder="The steps, in plain words" value={form.content} onChange={e => set({ content: e.target.value })} rows={6} style={{ ...input, resize: "vertical" }} />
      {importing && <div style={{ fontSize: 10.5, color: MUTED }}>Imported skills always ask you to review the full content before they're installed.</div>}
      <div style={{ display: "flex", gap: 6 }}>
        <Btn primary disabled={busy || !form.name.trim()} onClick={async () => { setBusy(true); await onCreate(form); setBusy(false); onClose(); }}>
          {importing ? "Import" : "Save skill"}
        </Btn>
        <Btn onClick={onClose}>Cancel</Btn>
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>{title} · {count}</div>
      {children}
    </div>
  );
}

export function SkillsPanel({ palette, onClose, draft, onDraftDone }: {
  palette: OverlayPalette;
  onClose: () => void;
  /** A skill written up from a Capture recording, opened straight in the guided maker. */
  draft?: CaptureDraft | null;
  onDraftDone?: () => void;
}) {
  const lib = useSkillLibrary();
  const requestChatTool = useJarvisStore(s => s.requestChatTool);
  const { checks, reload: reloadChecks } = useProcedureChecks();
  const [fromDoc, setFromDoc] = useState(false);
  const [docDraft, setDocDraft] = useState<DocumentDraft | null>(null);
  const [adding, setAdding] = useState(!!draft);
  const [getting, setGetting] = useState(false);
  const [pasting, setPasting] = useState(false);
  useEffect(() => { if (draft) { setAdding(true); setGetting(false); setPasting(false); } }, [draft]);
  const [domainFilter, setDomainFilter] = useState<number | "all">("all");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !lib.gate) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, lib.gate]);

  const inFilter = (s: SkillSet) => domainFilter === "all" || s.workDomainIds.includes(domainFilter);

  // Skills grouped by domain; a skill tagged with several domains appears
  // under each. Untagged ones go last.
  const groupByDomain = (list: SkillSet[]) => {
    const groups = lib.domains
      .filter(d => domainFilter === "all" || d.id === domainFilter)
      .map(d => ({ key: String(d.id), name: d.name, skills: list.filter(s => s.workDomainIds.includes(d.id)) }))
      .filter(g => g.skills.length > 0);
    const untagged = list.filter(s => s.workDomainIds.length === 0);
    if (untagged.length) groups.push({ key: "none", name: "No domain yet", skills: untagged });
    return groups;
  };
  const installedByDomain = useMemo(
    () => groupByDomain(lib.groups.installed.filter(inFilter)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lib.groups.installed, lib.domains, domainFilter],
  );
  const startersByDomain = useMemo(
    () => groupByDomain(lib.groups.available.filter(inFilter)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lib.groups.available, lib.domains, domainFilter],
  );

  const run = (s: SkillSet) => requestChatTool("run-skill", { skill: { name: s.name, content: s.content } });

  return (
    <>
      <div data-overlay-hit role="dialog" aria-label="My skills"
        style={{
          position: "fixed", left: 84, top: "50%", transform: "translateY(-50%)", width: 380,
          maxHeight: "calc(100vh - 80px)", display: "flex", flexDirection: "column",
          zIndex: 450, borderRadius: 16, overflow: "hidden",
          background: "rgba(8, 14, 28, 0.9)", border: `1px solid ${palette.chatBorder}`,
          backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", boxShadow: palette.glassShadow,
          fontFamily: "var(--j-font-ui)", color: TEXT,
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px 10px" }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{getting ? "Get skills" : "My skills"}</span>
          <Btn primary={getting} onClick={() => { setGetting(g => !g); setAdding(false); }}>{getting ? "Back to my skills" : <><Download size={12} />Get skills</>}</Btn>
          {!getting && <Btn onClick={() => setAdding(a => !a)} label="New skill"><Plus size={12} />New</Btn>}
          <button type="button" className="khi-icon-btn" onClick={onClose} aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
            <X size={15} color={MUTED} />
          </button>
        </div>

        {!getting && lib.domains.length > 0 && (
          <div role="radiogroup" aria-label="Filter by domain" style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 16px 10px" }}>
            {[{ id: "all" as const, name: "All" }, ...lib.domains].map(d => (
              <Chip key={d.id} active={domainFilter === d.id} onClick={() => setDomainFilter(d.id)}>{d.name}</Chip>
            ))}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {getting && <GetSkills tone="overlay" onInstall={lib.installFromGithub} />}
          {getting && lib.error && <div role="alert" style={{ fontSize: 12, color: "#ffb0b0" }}>{lib.error}</div>}
          {!getting && <>
          {/* New: the guided skill maker; "paste one" keeps the quick form for skills from elsewhere. */}
          {adding && !pasting && fromDoc && !docDraft && (
            <FromDocument tone="overlay" onDraft={d => setDocDraft(d)} onCancel={() => setFromDoc(false)} />
          )}
          {adding && !pasting && (!fromDoc || docDraft) && (
            <>
              <SkillGuide key={docDraft ? `doc-${docDraft.sourceSectionId}-${docDraft.name}` : draft ? `draft-${draft.name}` : 'new'} tone="overlay" initial={docDraft ?? draft ?? undefined}
                onCancel={() => { setAdding(false); setFromDoc(false); setDocDraft(null); onDraftDone?.(); }}
                onSave={async input => { await lib.create(input); setAdding(false); setFromDoc(false); setDocDraft(null); onDraftDone?.(); setTimeout(() => void reloadChecks(), 4000); }} />
              {!docDraft && !draft?.source && (
                <button type="button" onClick={() => setFromDoc(true)} style={{ background: "none", border: "none", color: MUTED, fontSize: 11.5, cursor: "pointer", textAlign: "left", padding: 0, fontFamily: "inherit" }}>
                  Start from a company document instead
                </button>
              )}
              <button type="button" onClick={() => setPasting(true)} style={{ background: "none", border: "none", color: MUTED, fontSize: 11.5, cursor: "pointer", textAlign: "left", padding: 0, fontFamily: "inherit" }}>
                Already have a skill written somewhere? Paste it instead
              </button>
            </>
          )}
          {adding && pasting && <NewSkillForm onCreate={lib.create} onClose={() => { setAdding(false); setPasting(false); }} />}
          {lib.error && <div role="alert" style={{ fontSize: 12, color: "#ffb0b0" }}>{lib.error}</div>}
          {lib.loading && <div style={{ fontSize: 12, color: MUTED }}>Loading skills…</div>}

          <Section title="Waiting for your confirmation" count={lib.groups.pending.filter(inFilter).length}>
            {lib.groups.pending.filter(inFilter).map(s => <SkillRow key={s.id} skill={s} domains={lib.domains} lib={lib} onRun={run} check={checks[s.id]} onRechecked={reloadChecks} />)}
          </Section>

          {installedByDomain.map(g => (
            <Section key={g.key} title={g.name} count={g.skills.length}>
              {g.skills.map(s => <SkillRow key={`${g.key}-${s.id}`} skill={s} domains={lib.domains} lib={lib} onRun={run} check={checks[s.id]} onRechecked={reloadChecks} />)}
            </Section>
          ))}

          {!lib.loading && lib.groups.installed.filter(inFilter).length === 0 && (
            <div style={{ fontSize: 12, color: MUTED }}>
              No skills installed{domainFilter === "all" ? "" : " in this domain"} yet. Install a starter skill below, or write your own with New.
            </div>
          )}

          {startersByDomain.length > 0 && (
            <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginTop: 4 }}>Starter skills - install the ones you want</div>
          )}
          {startersByDomain.map(g => (
            <Section key={`starter-${g.key}`} title={g.name} count={g.skills.length}>
              {g.skills.map(s => <SkillRow key={`starter-${g.key}-${s.id}`} skill={s} domains={lib.domains} lib={lib} onRun={run} check={checks[s.id]} onRechecked={reloadChecks} />)}
            </Section>
          ))}
          </>}
        </div>
      </div>
      {lib.gate && (
        <div data-overlay-hit>
          <SkillConfirmGate gate={lib.gate} onConfirm={lib.confirmGate} onCancel={lib.cancelGate} />
        </div>
      )}
    </>
  );
}
