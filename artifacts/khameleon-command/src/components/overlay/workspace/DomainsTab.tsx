import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { getWorkDomains, createWorkDomain, renameWorkDomain, deleteWorkDomain, type WorkDomain } from "@/lib/workDomainsApi";
import { getSkillSets, type SkillSet } from "@/lib/skillSetsApi";
import { TEXT, MUTED, inputStyle, Btn } from "./ui";
import { ProcedureDocuments } from "@/components/procedures/ProcedureDocuments";

/**
 * Workspace -> Domains & documents (gap review Q3/Q7, Build 5). The areas of
 * work skills are grouped by, each holding its procedure documents.
 * Same endpoints as Classic's domain filter bar (Skills page).
 */

function DomainRow({ domain, skillCount, onSave, onDelete }: {
  domain: WorkDomain;
  skillCount: number;
  onSave: (name: string, description: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [name, setName] = useState(domain.name);
  const [description, setDescription] = useState(domain.description);

  if (editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.035)" }}>
        <input aria-label="Domain name" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        <input aria-label="Domain description" placeholder="What this area covers" value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
        <div style={{ display: "flex", gap: 6 }}>
          <Btn primary disabled={!name.trim()} onClick={() => { onSave(name.trim(), description.trim()); setEditing(false); }}>Save</Btn>
          <Btn onClick={() => { setName(domain.name); setDescription(domain.description); setEditing(false); }}>Cancel</Btn>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 10px", borderRadius: 10, background: "rgba(255,255,255,0.035)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: TEXT }}>{domain.name}</div>
        {domain.description && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{domain.description}</div>}
        <div style={{ fontSize: 10.5, color: MUTED, marginTop: 4, display: "flex", gap: 10, alignItems: "center" }}>
          <span>{skillCount} skill{skillCount === 1 ? "" : "s"}</span>
          <button type="button" onClick={() => setShowDocs(v => !v)} aria-expanded={showDocs}
            style={{ background: "none", border: "none", padding: 0, color: "#6FE6BD", fontSize: 10.5, cursor: "pointer", fontFamily: "inherit" }}>
            {showDocs ? "Hide procedure documents" : "Procedure documents"}
          </button>
        </div>
        {showDocs && <div style={{ marginTop: 8 }}><ProcedureDocuments tone="overlay" workDomainId={domain.id} /></div>}
        {confirmDelete && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
            <span style={{ fontSize: 11.5, color: TEXT }}>Delete "{domain.name}"? Skills stay, they just lose this tag.</span>
          </div>
        )}
      </div>
      {confirmDelete ? (
        <>
          <Btn danger onClick={onDelete}>Delete</Btn>
          <Btn onClick={() => setConfirmDelete(false)}>Keep</Btn>
        </>
      ) : (
        <>
          <Btn onClick={() => setEditing(true)} label={`Rename ${domain.name}`}><Pencil size={12} /></Btn>
          <Btn danger onClick={() => setConfirmDelete(true)} label={`Delete ${domain.name}`}><Trash2 size={12} /></Btn>
        </>
      )}
    </div>
  );
}

export function DomainsTab() {
  const [domains, setDomains] = useState<WorkDomain[] | null>(null);
  const [skills, setSkills] = useState<SkillSet[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    getWorkDomains().then(setDomains).catch(() => setDomains([]));
    getSkillSets().then(setSkills);
  }, []);
  useEffect(reload, [reload]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); reload(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
  };

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of skills) if (s.status !== "uninstalled") for (const id of s.workDomainIds) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [skills]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.45 }}>
        The areas of your work. Skills are grouped by these, and each one holds your company's procedure documents - skills in that area are checked against them step by step.
      </div>
      <form onSubmit={e => { e.preventDefault(); if (newName.trim()) void act(async () => { await createWorkDomain(newName.trim()); setNewName(""); }); }}
        style={{ display: "flex", gap: 6 }}>
        <input aria-label="New domain" placeholder="Add a domain (e.g. Finance)" value={newName} onChange={e => setNewName(e.target.value)} style={inputStyle} />
        <Btn primary disabled={!newName.trim()} label="Add domain"
          onClick={() => void act(async () => { await createWorkDomain(newName.trim()); setNewName(""); })}><Plus size={12} /></Btn>
      </form>
      {error && <div role="alert" style={{ fontSize: 12, color: "#ffb0b0" }}>{error}</div>}
      {domains === null && <div style={{ fontSize: 12, color: MUTED }}>Loading…</div>}
      {domains?.map(d => (
        <DomainRow key={d.id} domain={d} skillCount={counts.get(d.id) ?? 0}
          onSave={(name, description) => void act(() => renameWorkDomain(d.id, name, description))}
          onDelete={() => void act(() => deleteWorkDomain(d.id))} />
      ))}
    </div>
  );
}
