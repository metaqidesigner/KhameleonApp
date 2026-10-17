import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmGate } from '@/components/ConfirmGate';
import {
  getSkillSets, createSkillSet, confirmSkillSetInstall, uninstallSkillSet, installSkillSetFromCatalog,
  updateSkillSet, confirmSkillSetUpdate,
  type SkillSet, type CreateSkillSetInput,
} from '@/lib/skillSetsApi';
import { getWorkDomains, setEntityWorkDomains, type WorkDomain } from '@/lib/workDomainsApi';
import { installSkillFromGithub } from '@/lib/skillSourcesApi';

/**
 * Skills logic shared by the Overlay's Skills panel and Classic's Skills
 * page (docs/build-review.md, Builds 0 + 3): one implementation, two views.
 * Install/import/update go through the existing confirm gate whenever the
 * server says so (design-spec.md §15.3-15.5).
 */

export type SkillGate =
  | { kind: 'install'; skillSet: SkillSet; approvalId: number | null; fullContent: boolean }
  | { kind: 'update'; skillSet: SkillSet; approvalId: number | null; requestedTools: string[]; requestedIntegrationIds: string[] };

export function useSkillLibrary() {
  const [skills, setSkills] = useState<SkillSet[]>([]);
  const [domains, setDomains] = useState<WorkDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<SkillGate | null>(null);

  const reload = useCallback(() => {
    getSkillSets().then(rows => { setSkills(rows); setLoading(false); });
    getWorkDomains().then(setDomains).catch(() => {});
  }, []);
  useEffect(reload, [reload]);

  const attempt = useCallback(async (fn: () => Promise<void>, fallback: string) => {
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : fallback); }
  }, []);

  const groups = useMemo(() => ({
    installed: skills.filter(s => s.status === 'installed'),
    pending: skills.filter(s => s.status === 'pending'),
    available: skills.filter(s => s.status === 'available'),
  }), [skills]);

  return {
    skills, groups, domains, loading, error, gate, reload,
    clearError: () => setError(null),

    create: (input: CreateSkillSetInput) => attempt(async () => {
      const { skillSet, approvalId } = await createSkillSet(input);
      if (approvalId) setGate({ kind: 'install', skillSet, approvalId, fullContent: input.sourceType !== 'authored' });
      reload();
    }, "Couldn't create the skill"),

    /** Starter skills and accepted suggestions - previously had no button anywhere. */
    install: (s: SkillSet) => attempt(async () => {
      const { skillSet, approvalId } = await installSkillSetFromCatalog(s.id);
      if (approvalId) setGate({ kind: 'install', skillSet, approvalId, fullContent: skillSet.sourceType !== 'authored' });
      reload();
    }, "Couldn't install the skill"),

    /** Get skills: install from a GitHub link - always shows the full-content gate (outside source). */
    installFromGithub: (url: string) => attempt(async () => {
      const { skillSet, approvalId } = await installSkillFromGithub(url);
      const row = { ...skillSet, workDomainIds: skillSet.workDomainIds ?? [], pendingApprovalId: approvalId };
      if (approvalId) setGate({ kind: 'install', skillSet: row, approvalId, fullContent: true });
      reload();
    }, "Couldn't install the skill"),

    reviewPending: (s: SkillSet) => setGate({ kind: 'install', skillSet: s, approvalId: s.pendingApprovalId, fullContent: s.sourceType !== 'authored' }),

    remove: (s: SkillSet) => attempt(async () => { await uninstallSkillSet(s.id); reload(); }, "Couldn't remove the skill"),

    saveSteps: (s: SkillSet, content: string) => attempt(async () => {
      const r = await updateSkillSet(s.id, { content });
      if (r.approvalId) {
        setGate({
          kind: 'update', skillSet: r.skillSet, approvalId: r.approvalId,
          requestedTools: r.pendingScope?.requestedTools ?? s.requestedTools,
          requestedIntegrationIds: r.pendingScope?.requestedIntegrationIds ?? s.requestedIntegrationIds,
        });
      }
      reload();
    }, "Couldn't save the changes"),

    toggleDomain: (s: SkillSet, domainId: number) => attempt(async () => {
      const next = s.workDomainIds.includes(domainId) ? s.workDomainIds.filter(id => id !== domainId) : [...s.workDomainIds, domainId];
      await setEntityWorkDomains('skill_set', String(s.id), next);
      reload();
    }, "Couldn't update the domains"),

    confirmGate: async () => {
      if (!gate) return;
      try {
        if (gate.kind === 'install') await confirmSkillSetInstall(gate.skillSet.id, gate.approvalId);
        else await confirmSkillSetUpdate(gate.skillSet.id, gate.approvalId, gate.requestedTools, gate.requestedIntegrationIds);
        setGate(null);
        reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't confirm");
        throw e; // keeps the gate open for a retry
      }
    },
    cancelGate: () => setGate(null),
  };
}

/** The confirm step for installs and scope-changing edits - same gate in both layouts. */
export function SkillConfirmGate({ gate, onConfirm, onCancel }: { gate: SkillGate; onConfirm: () => Promise<void>; onCancel: () => void }) {
  const s = gate.skillSet;
  const tools = gate.kind === 'update' ? gate.requestedTools : s.requestedTools;
  const integrations = gate.kind === 'update' ? gate.requestedIntegrationIds : s.requestedIntegrationIds;
  const external = gate.kind === 'install' && gate.fullContent;
  return (
    <ConfirmGate
      title={gate.kind === 'install' ? `Install "${s.name}"` : `Save changes to "${s.name}"`}
      category={gate.kind === 'install' ? (external ? 'Install a skill from outside Khameleon' : 'Install a skill') : 'Change a skill'}
      target={s.name}
      targetLabel="Skill"
      scope={tools.length || integrations.length ? [...tools, ...integrations].join(', ') : 'No extra tools or integrations - instructions only'}
      scopeLabel="Access it asks for"
      payloadLabel="What it will do (full instructions)"
      severity={external ? 'high' : 'medium'}
      confirmLabel={gate.kind === 'install' ? 'Confirm & Install' : 'Confirm & Save'}
      warning={external
        ? `From ${s.sourceUrl ?? s.sourceType}${s.sourceAuthor ? `, by ${s.sourceAuthor}` : ''}. Read the instructions below before installing - they'll guide the AI whenever this skill is used.`
        : gate.kind === 'update' ? 'This change gives the skill access it did not have before.' : undefined}
      payload={
        <div style={{ whiteSpace: 'pre-wrap' }}>{s.content || '(no content)'}</div>
      }
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

/** What the chat receives when a skill is run - its steps plus the user's task. */
export function runSkillPrompt(s: Pick<SkillSet, 'name' | 'content'>, task: string): string {
  return `Use the "${s.name}" skill for this. Follow its steps:\n---\n${s.content.trim() || '(no steps written yet)'}\n---\nWhat to work on: ${task.trim()}`;
}
