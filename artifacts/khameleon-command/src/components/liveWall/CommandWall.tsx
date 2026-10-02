import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  Activity, AlertTriangle, Archive, ArrowUpRight, Bell, Bot, CheckCircle2, ChevronDown, ChevronRight, Clock, Eye, EyeOff, Filter,
  GitBranch, GripVertical, LockKeyhole, Mail, Pause, Play,
  Plug, Radio, RotateCcw, Send, Sparkles, Timer, Wand2, X,
} from "lucide-react";
import { useJarvisStore } from "@/store/jarvisStore";
import { useJarvisHealth, useJarvisTelemetry } from "@/hooks/useJarvis";
import {
  getDailyTasks, getConnectors, getTasks, updateTask, type Task, type TaskCategory, type JarvisConnector,
} from "@/lib/jarvisApi";
import {
  streamAgentChat, FALLBACK_ROSTER, getRoster, getAgentStatus,
  type AgentConfig, type AgentStatus, type ChatMessage,
} from "@/lib/agentsApi";

/**
 * Ported from the Replit "CommandWall" design (artifacts/mockup-sandbox's
 * live-wall/CommandWall.tsx, khameleon-orb-states-preview.html's color
 * states, and khameleon-home-implemented.html's texture) — kept faithful
 * to the original visual design (every CSS rule below is unchanged), but
 * every data-bearing piece now reads real state instead of the demo's
 * fixed numbers:
 *   - domain filters + task routing → real /tasks/daily data, grouped by
 *     the app's actual TaskCategory values (there's no real "People/
 *     Operations/Governance/Growth" taxonomy, so this uses the taxonomy
 *     that actually exists)
 *   - "parked orbit" → real tasks that are blocked/not-yet-started,
 *     rather than fixed placeholder cards; the original's video-review
 *     card is dropped entirely (no such feature exists in this app)
 *   - "wall status" → real health/telemetry (uptime, latency, queries,
 *     cost), replacing fabricated stats ("Signal health: 87", "Data
 *     posture: Zero retention") that had nothing real behind them
 *   - reasoning trace → a real task's own aiRecommendation field when one
 *     exists, an honest empty state otherwise
 *   - footer ticker → the real agent-activity feed
 *   - orb window → the real orbStatus/chat pipeline (same
 *     streamAgentChat flow AssistantCard uses, including the
 *     research-role → "researching" state check), not local-only demo
 *     state. The state-button row stays as a real manual override (each
 *     button really does call setOrbStatus) - the only piece NOT wired to
 *     anything live is the original's audio-reactive "speaking" demo,
 *     which played a bundled MP3 through a Web Audio analyser; that demo
 *     file doesn't exist in this app, and browser text-to-speech doesn't
 *     expose an analysable audio stream the same way, so "speaking" here
 *     triggers real TTS of a short line instead - the orb still visibly
 *     pulses (the CSS speaking animation isn't audio-driven at rest), just
 *     without the demo's fine-grained per-frequency reactivity. The
 *     analyser hook itself (useOrbOutputAudio.ts) was still brought over
 *     unchanged and is genuinely reusable if a real playable output
 *     stream exists later - it just isn't wired into anything yet.
 */

type OrbState = "online" | "listening" | "thinking" | "researching" | "speaking" | "error" | "offline" | "muted";
type WallOrbState = "idle" | "listening" | "thinking" | "researching" | "speaking" | "error" | "muted";
type Mode = "Single" | "Parallel" | "Vote" | "Council";

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  communication: "Communication",
  meetings: "Meetings",
  deep_work: "Deep work",
  task_project_management: "Projects",
  administrative: "Admin",
  planning: "Planning",
};
const CATEGORY_ACCENTS: Record<TaskCategory, string> = {
  communication: "#63e1d3",
  meetings: "#a999ff",
  deep_work: "#e9b872",
  task_project_management: "#f68e7b",
  administrative: "#63e1d3",
  planning: "#a999ff",
};
const CATEGORIES = Object.keys(CATEGORY_LABELS) as TaskCategory[];

type ParkedReason = "external_input" | "deferred" | "dependency";
const PARKED_REASON_LABELS: Record<ParkedReason, string> = {
  external_input: "Waiting on a reply",
  deferred: "Deferred by you",
  dependency: "Blocked by a dependency",
};
const PARKED_REASON_ICONS: Record<ParkedReason, typeof Mail> = {
  external_input: Mail,
  deferred: Clock,
  dependency: GitBranch,
};
const MODE_ABBR: Record<Mode, string> = { Single: "S", Parallel: "P", Vote: "V", Council: "C" };

function toWallState(s: OrbState): WallOrbState {
  return s === "online" || s === "offline" ? "idle" : s;
}
function fromWallState(s: WallOrbState): OrbState {
  return s === "idle" ? "online" : s;
}
function fmtMs(n?: number)     { return n != null ? `${n.toFixed(0)}ms` : "0ms"; }
function fmtUptime(s: number)  { if (!s) return "0h 0m"; return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`; }
function fmtCost(n?: number)   { return n != null ? `$${n.toFixed(4)}` : "$0.0000"; }
function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function fmtSentDate(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short" });
}

/**
 * Scale-to-fit (2026-10-02, per Newton's request): the Live Wall's internal
 * layout is hand-tuned around a fixed design size (DESIGN_WIDTH x
 * DESIGN_HEIGHT, matching .wall-shell's real measured footprint at a normal
 * desktop viewport) - rather than rework every absolute-positioned panel to
 * be independently fluid, the whole wall is rendered at its native design
 * size and uniformly scaled (like a game letterboxing to the window) to
 * exactly fill whatever space the tab's content area actually has, on any
 * screen size, with zero scrolling. A ResizeObserver re-measures and
 * re-scales live as the window resizes. Only an actually-too-small window
 * (smaller than MIN_SCALE allows) stops shrinking further, matching Newton's
 * own caveat that a deliberately minimised window is a different case.
 */
const STAGE_DESIGN_WIDTH = 1388;
const STAGE_DESIGN_HEIGHT = 800;
const STAGE_MIN_SCALE = 0.5;

function useStageFit(designWidth: number, designHeight: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const next = Math.min(width / designWidth, height / designHeight);
      setScale(Math.max(STAGE_MIN_SCALE, next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [designWidth, designHeight]);

  return { containerRef, scale };
}

export function CommandWall() {
  const { containerRef: stageRef, scale: stageScale } = useStageFit(STAGE_DESIGN_WIDTH, STAGE_DESIGN_HEIGHT);
  const orbStatus           = useJarvisStore(s => s.orbStatus);
  const setOrbStatus        = useJarvisStore(s => s.setOrbStatus);
  const orbActiveAgentId    = useJarvisStore(s => s.orbActiveAgentId);
  const voiceSettings       = useJarvisStore(s => s.voiceSettings);
  const pushAgentEvent      = useJarvisStore(s => s.pushAgentEvent);
  const agentHistory        = useJarvisStore(s => s.agentHistory);
  const taskRevision        = useJarvisStore(s => s.taskRevision);
  const adjustEmbeddedOrbMountCount = useJarvisStore(s => s.adjustEmbeddedOrbMountCount);
  const { data: health    = undefined } = useJarvisHealth();
  const { data: telemetry = undefined } = useJarvisTelemetry();

  const [activeDomains, setActiveDomains] = useState<Set<TaskCategory>>(new Set());
  const [mode, setMode] = useState<Mode>("Parallel");
  const [isLive, setIsLive] = useState(true);
  const [showReasoning, setShowReasoning] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [domainMenuOpen, setDomainMenuOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  // Top bar spec (2026-09-25): icon-only controls need a first-run labeled
  // pass since orchestration-mode's S/P/V/C abbreviation isn't self
  // explanatory on first use. Persisted per-browser so it only shows once.
  const [topBarLabeled, setTopBarLabeled] = useState(() => {
    try { return localStorage.getItem("khameleon-topbar-seen") !== "1"; } catch { return true; }
  });
  const [chatDraft, setChatDraft] = useState("");
  const [chatSent, setChatSent] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [roster, setRoster] = useState<AgentConfig[]>(FALLBACK_ROSTER);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [connectors, setConnectors] = useState<JarvisConnector[]>([]);
  const [dailyData, setDailyData] = useState<Record<string, Task[]>>({});
  const [byCategory, setByCategory] = useState<Record<string, number>>({});
  const [totalTasks, setTotalTasks] = useState(0);
  const [doneTasks, setDoneTasks] = useState(0);
  const [recentDone, setRecentDone] = useState<Task[]>([]);
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [draggedQueueId, setDraggedQueueId] = useState<number | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [focusAnnouncement, setFocusAnnouncement] = useState<string | null>(null);
  const promotedIdsRef = useRef<Set<number>>(new Set());

  const streamBufRef = useRef("");
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  const loadTasks = useCallback(() => {
    getDailyTasks().then(d => {
      setDailyData(d.sections ?? {});
      setByCategory(d.byCategory ?? {});
      setTotalTasks(d.total ?? 0);
      setDoneTasks(d.doneCount ?? 0);
    });
    // getDailyTasks' own "done" bucket is id-only (no title) - the recent
    // completions trail needs real titles, so this reads the plain /tasks
    // list filtered server-side instead of trying to reuse that response.
    getTasks({ status: "done" }).then(setRecentDone);
  }, []);
  useEffect(() => { loadTasks(); }, [loadTasks, taskRevision]);
  // This page carries its own orb-window (below) - suppress the persistent
  // floating orb while it's mounted, the same mechanism AssistantCard uses
  // (see its own comment for why this exists: never more than one orb).
  useEffect(() => {
    adjustEmbeddedOrbMountCount(1);
    return () => adjustEmbeddedOrbMountCount(-1);
  }, [adjustEmbeddedOrbMountCount]);
  useEffect(() => { getRoster().then(setRoster).catch(() => {}); }, []);
  // First-run labeled pass: mark this session as "seen" immediately, so the
  // *next* session starts icons-only - this session stays labeled throughout
  // rather than fading mid-session, since the control most needing a label
  // (orchestration mode's S/P/V/C) benefits from a stable first look.
  useEffect(() => {
    if (topBarLabeled) { try { localStorage.setItem("khameleon-topbar-seen", "1"); } catch { /* private mode etc - just stays labeled every session */ } }
  }, [topBarLabeled]);
  useEffect(() => { getConnectors().then(setConnectors).catch(() => {}); }, []);
  useEffect(() => {
    if (!modeMenuOpen && !domainMenuOpen) return;
    const closeOnOutsideClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".bar-menu")) return;
      setModeMenuOpen(false);
      setDomainMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [modeMenuOpen, domainMenuOpen]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(roster.map(a => getAgentStatus(a.id).then(s => [a.id, s.status] as const).catch(() => [a.id, "offline"] as const)))
      .then(pairs => { if (!cancelled) setAgentStatuses(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  }, [roster]);
  useEffect(() => {
    if ("speechSynthesis" in window) {
      const load = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
  }, []);

  const allTasks = useMemo(
    () => Object.values(dailyData).flat(),
    [dailyData],
  );
  // Parked (2026-09-25 left-column spec): work stalled on something outside
  // the agent's control - distinct from a plain 'todo' task that just
  // hasn't started yet (that's the center column's queue now, see below).
  // A task counts as parked if it's genuinely blocked, or explicitly
  // reason-tagged (a 'deferred' task can still be status:'todo' - it's the
  // parkedReason tag that makes it parked, not the status alone). Blocked
  // tasks without a reason tag yet fall into "unsorted" rather than being
  // hidden or guessed at.
  const allParked = useMemo(
    () => allTasks.filter(t => t.status === "blocked" || t.parkedReason != null),
    [allTasks],
  );
  const parkedByReason = useMemo(() => ({
    external_input: allParked.filter(t => t.parkedReason === "external_input"),
    deferred:       allParked.filter(t => t.parkedReason === "deferred"),
    dependency:     allParked.filter(t => t.parkedReason === "dependency"),
  }), [allParked]);
  const unsortedParked = useMemo(
    () => allParked.filter(t => t.parkedReason == null).slice(0, 3),
    [allParked],
  );
  const parkedIds = useMemo(() => new Set(allParked.map(t => t.id)), [allParked]);
  const taskById = useMemo(() => new Map(allTasks.map(t => [t.id, t])), [allTasks]);

  // Center column "current focus + queue" (2026-09-26). Focus prioritizes a
  // task that genuinely needs the user's input over one merely in progress
  // (a needs-input task is more urgent to surface), then falls back to
  // whichever in-progress task was touched most recently - the Workspace
  // canvas still allows unlimited concurrent tasks (design-spec.md §5),
  // this just picks one of them to feature here, it doesn't restrict that.
  const focusTask = useMemo(() => {
    const byRecency = (a: Task, b: Task) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    const needsInput = allTasks.filter(t => t.status === "needs_input").sort(byRecency);
    if (needsInput.length > 0) return needsInput[0];
    return allTasks.filter(t => t.status === "in_progress").sort(byRecency)[0] ?? null;
  }, [allTasks]);
  // Queue = forward plan, not-yet-started work - distinct from parked
  // (stalled on something outside the agent's control) and from focus
  // (the one thing active right now). Ordered by real, persisted
  // queuePosition (drag-to-reorder writes this) with createdAt as the
  // tie-breaker for anything not yet manually ordered.
  const queueTasks = useMemo(() => {
    const candidates = allTasks.filter(t =>
      t.status === "todo" && !parkedIds.has(t.id) && t.id !== focusTask?.id &&
      (activeDomains.size === 0 || activeDomains.has(t.category)),
    );
    return candidates.sort((a, b) => {
      const ap = a.queuePosition ?? Number.MAX_SAFE_INTEGER;
      const bp = b.queuePosition ?? Number.MAX_SAFE_INTEGER;
      return ap !== bp ? ap - bp : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [allTasks, parkedIds, focusTask, activeDomains]);
  const sortedRecentDone = useMemo(
    () => [...recentDone].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5),
    [recentDone],
  );
  function agentName(id?: string | null): string | null {
    if (!id) return null;
    return roster.find(a => a.id === id)?.name ?? id;
  }
  async function reorderQueue(draggedId: number, targetId: number) {
    if (draggedId === targetId) return;
    const ids = queueTasks.map(t => t.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const reordered = [...ids];
    reordered.splice(from, 1);
    reordered.splice(to, 0, draggedId);
    await Promise.all(reordered.map((id, i) => updateTask(id, { queuePosition: i })));
    loadTasks();
  }
  async function resumeParkedTask(task: Task) {
    await updateTask(task.id, { status: "todo", parkedReason: null, waitingOn: null, waitingSince: null, blockedByTaskId: null });
    loadTasks();
  }
  // Auto-promote (2026-09-26): when nothing is in focus and the queue has
  // work, the top item becomes focus immediately - no manual confirm click,
  // per the spec, with a brief on-screen announcement so the switch isn't
  // silent. promotedIdsRef guards against re-promoting the same task if the
  // update round-trip is slower than a re-render.
  useEffect(() => {
    if (focusTask || queueTasks.length === 0 || promoting) return;
    const next = queueTasks[0];
    if (promotedIdsRef.current.has(next.id)) return;
    promotedIdsRef.current.add(next.id);
    setPromoting(true);
    updateTask(next.id, { status: "in_progress" })
      .then(() => {
        setFocusAnnouncement(`Now focusing: ${next.title}`);
        loadTasks();
        setTimeout(() => setFocusAnnouncement(null), 4000);
      })
      .finally(() => setPromoting(false));
  }, [focusTask, queueTasks, promoting, loadTasks]);
  const ticker = useMemo(() => {
    if (agentHistory.length === 0) return "No recent activity — query Khameleon to begin.";
    return agentHistory.slice(0, 6)
      .map(ev => `${ev.agent} · ${ev.prompt.slice(0, 60)}`)
      .join("　///　");
  }, [agentHistory]);

  const wallState = toWallState(orbStatus);

  function speakDemo(text: string) {
    if (!("speechSynthesis" in window)) { setOrbStatus("error"); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceSettings.rate; utterance.pitch = voiceSettings.pitch;
    utterance.volume = voiceSettings.volume; utterance.lang = voiceSettings.lang;
    const voice = voicesRef.current.find(v => v.lang.startsWith("en"));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setOrbStatus("speaking");
    utterance.onend = () => setOrbStatus("online");
    utterance.onerror = () => setOrbStatus("online");
    window.speechSynthesis.speak(utterance);
  }

  function selectOrbState(state: WallOrbState) {
    if (state === "speaking") { speakDemo("Hello. I'm Khameleon."); return; }
    setOrbStatus(fromWallState(state));
  }

  const handleSend = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setChatSent(trimmed);
    setChatDraft("");
    setStreaming(true);
    const activeAgent = roster.find(a => a.id === orbActiveAgentId);
    setOrbStatus(activeAgent?.role === "research" ? "researching" : "thinking");
    streamBufRef.current = "";

    const history: ChatMessage[] = [{ role: "user", content: trimmed }];
    const assistantId = crypto.randomUUID();
    streamAgentChat(
      orbActiveAgentId,
      history,
      (token) => { streamBufRef.current += token; },
      (done) => {
        setStreaming(false);
        const full = streamBufRef.current;
        pushAgentEvent({
          id: assistantId, prompt: trimmed, response: full,
          model: done.model, agent: orbActiveAgentId,
          ts: Date.now(), durationMs: done.latencyMs, tokens: done.tokens, costUsd: done.costUsd,
        });
        if (full) speakDemo(full.slice(0, voiceSettings.maxSpeakLength)); else setOrbStatus("online");
      },
      (err) => {
        setStreaming(false);
        const offline = err.includes("unreachable") || err.includes("fetch") || err.includes("network");
        setOrbStatus(offline ? "offline" : "error");
        if (!offline) setTimeout(() => setOrbStatus("online"), 900);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming, roster, orbActiveAgentId, pushAgentEvent, voiceSettings]);

  function submitChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSend(chatDraft);
  }

  return (
    <div ref={stageRef} className="wall-stage-fit">
    {/* This sizing div's own layout box is the real, scaled footprint
        (unlike .wall-shell's, which transform:scale() leaves at its
        unscaled 1388x800 for layout purposes) - giving the flex-centered
        overflow container something correctly-sized to center means any
        overflow (only expected on a deliberately tiny/extreme window) is
        genuinely reachable by scroll from every edge, not just hidden by
        the classic flex-centering-clips-the-start-edge quirk. */}
    <div style={{ width: STAGE_DESIGN_WIDTH * stageScale, height: STAGE_DESIGN_HEIGHT * stageScale, flexShrink: 0 }}>
    <main className="wall-shell" style={{ width: STAGE_DESIGN_WIDTH, height: STAGE_DESIGN_HEIGHT, transform: `scale(${stageScale})`, transformOrigin: 'top left' }}>
      <style>{`
        .wall-stage-fit{width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:auto}
        .wall-shell{--ink:#e8f3f0;--muted:#78908f;--teal:#63e1d3;--violet:#a999ff;--amber:#e9b872;--coral:#f68e7b;position:relative;isolation:isolate;overflow:hidden;background:rgba(5,15,23,.16);color:var(--ink);font-family:ui-sans-serif,system-ui,sans-serif}
        .space-field{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;background:radial-gradient(ellipse at 50% 98%,rgba(80,198,211,.12),transparent 34%)}.space-field:before{content:"";position:absolute;inset:0;opacity:.48;background-image:radial-gradient(circle at 11% 22%,rgba(210,255,247,.92) 0 1px,transparent 1.8px),radial-gradient(circle at 25% 17%,rgba(136,205,255,.72) 0 1px,transparent 1.7px),radial-gradient(circle at 43% 28%,rgba(255,225,170,.7) 0 1px,transparent 1.7px),radial-gradient(circle at 66% 13%,rgba(201,181,255,.85) 0 1px,transparent 1.8px),radial-gradient(circle at 83% 25%,rgba(166,250,240,.75) 0 1px,transparent 1.7px)}.reflection-plane{position:absolute;left:3%;right:3%;bottom:-2px;height:170px;z-index:0;pointer-events:none;opacity:.7;transform:perspective(520px) rotateX(58deg);transform-origin:bottom;background:linear-gradient(to bottom,rgba(7,24,31,.08),rgba(3,10,18,.72)),radial-gradient(ellipse at 50% 0,rgba(108,243,231,.12),transparent 46%);border-top:1px solid rgba(145,244,235,.14);box-shadow:0 -18px 45px rgba(62,218,213,.1)}
        .topbar,.wall-plane,.footer{position:relative;z-index:1}.glass{position:relative;overflow:hidden;background:rgba(10,18,20,.5);border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.1),0 0 24px rgba(111,230,189,.12);backdrop-filter:blur(16px)}.glass:before{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(122deg,rgba(255,255,255,.08) 0%,rgba(255,255,255,0) 30%);pointer-events:none;z-index:0}.glass:after{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.55) 35%,rgba(255,255,255,0) 70%);pointer-events:none;z-index:2}.glass>*{position:relative;z-index:1}
        .topbar{height:74px;margin:18px 22px 6px;padding:0 20px;border-radius:19px;display:flex;align-items:center;gap:28px}.brand{display:flex;align-items:center;gap:11px;min-width:220px}.brand-mark{width:26px;height:26px;position:relative}.brand-mark i{position:absolute;width:8px;height:8px;border:2px solid var(--teal);border-radius:50%;box-shadow:0 0 14px rgba(99,225,211,.6)}.brand-mark i:nth-child(1){left:1px;top:9px}.brand-mark i:nth-child(2){left:9px;top:3px}.brand-mark i:nth-child(3){left:17px;top:11px}.wordmark{font-size:15px;letter-spacing:.2em;font-weight:700}.wordmark small{display:block;color:#73918f;font-size:8px;letter-spacing:.16em;margin-top:3px;font-weight:500}.nav{display:flex;gap:23px;align-items:center;flex:1}.nav button{border:0;background:none;color:#78908f;font-size:12px;padding:25px 0 22px;cursor:pointer}.nav button.active{color:var(--teal);border-bottom:2px solid var(--teal)}.top-right{display:flex;align-items:center;gap:8px}
        /* Top bar spec (2026-09-25): icon-first, compact global controls that
           act on the whole wall (all three lanes) - live/pause, orchestration
           mode, Work Domain filter, reasoning-visibility default, activity
           feed. First-run shows a label alongside each icon (see topBarLabeled
           in the component); every control also carries a hover title as the
           non-negotiable minimum even once icons-only. */
        .bar-btn{position:relative;display:flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#9db4b1;border-radius:9px;padding:8px 10px;font-size:10px;cursor:pointer;white-space:nowrap}
        .bar-btn.live{color:var(--teal);border-color:rgba(99,225,211,.28);background:rgba(99,225,211,.08)}.bar-btn.live svg{animation:live-pulse 2s ease-in-out infinite}
        .bar-btn.live.paused{color:var(--amber);border-color:rgba(233,184,114,.28);background:rgba(233,184,114,.07)}.bar-btn.live.paused svg{animation:none}
        @keyframes live-pulse{0%,100%{opacity:1}50%{opacity:.45}}
        .bar-chip-abbr{display:grid;place-items:center;width:16px;height:16px;border-radius:5px;background:rgba(99,225,211,.16);color:var(--teal);font-size:9px;font-weight:700}
        .bar-badge{position:absolute;top:-5px;right:-5px;min-width:15px;height:15px;padding:0 3px;border-radius:8px;background:var(--coral);color:#1a0e0c;font-size:8px;font-weight:700;display:grid;place-items:center;line-height:1}
        .bar-menu{position:relative}.bar-pop{position:absolute;right:0;top:38px;min-width:150px;padding:6px;border-radius:10px;z-index:6}
        .bar-pop button{display:flex;align-items:center;gap:7px;width:100%;text-align:left;border:0;background:none;padding:7px 8px;border-radius:6px;color:#9db4b1;font-size:10px;cursor:pointer}
        .bar-pop button.active{color:var(--teal);background:rgba(99,225,211,.08)}
        .activity-scrim{position:fixed;inset:0;z-index:500;background:rgba(3,10,15,.4)}
        .activity-slideout{position:absolute;right:0;top:0;bottom:0;width:min(340px,90vw);padding:18px;overflow-y:auto;border-radius:0}
        .activity-slideout-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.activity-slideout-head strong{font-size:13px}.activity-slideout-head button{border:0;background:none;color:#9db4b1;cursor:pointer}
        .activity-empty{font-size:10px;color:#718987;line-height:1.5}
        .activity-slideout-item{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06)}.activity-slideout-top{display:flex;justify-content:space-between;font-size:9px;color:var(--teal);margin-bottom:5px}.activity-slideout-item p{margin:0;font-size:10px;color:#c3d3d0;line-height:1.4}
         .wall-plane{height:574px;margin:0 22px;position:relative}.panel{position:absolute;overflow:visible}.panel:after{content:"";position:absolute;right:-70px;top:-90px;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,rgba(99,225,211,.13),transparent 65%);filter:blur(5px);pointer-events:none}.eyebrow,.micro{color:#6c8685;font-size:10px;letter-spacing:.16em;text-transform:uppercase}.panel-title{font-size:18px;font-weight:600;letter-spacing:-.03em;margin-top:5px}.panel-title span{color:var(--teal)}.panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.status-pill,.privacy{display:flex;align-items:center;gap:7px;padding:7px 10px;border-radius:8px;font-size:10px;color:var(--teal);background:rgba(99,225,211,.08);border:1px solid rgba(99,225,211,.16)}.privacy{color:#b8aaff;border-color:rgba(169,153,255,.2)}.left-cluster{left:1%;top:8px;width:29%;height:435px;transform:rotate(-1.6deg);z-index:2}.center-cluster{left:25%;top:8px;width:53%;height:550px;z-index:3}.right-cluster{right:1%;top:8px;width:23%;height:390px;transform:rotate(1.8deg);z-index:2}
        .mission{position:relative;border-radius:16px;padding:13px 15px;background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.06)}.mission-top{display:flex;justify-content:space-between;align-items:center}.mission strong{font-size:12px}.mission p{font-size:10px;color:#8ca2a1;line-height:1.5;margin:8px 0 0}
        .route-head{display:flex;justify-content:space-between;align-items:end;margin:12px 0 9px}.route-head strong{font-size:13px}.route-head span{display:block;color:#6d8684;font-size:9px;margin-top:4px}.rail-stat{padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)}.rail-stat span{display:block;color:#76918e;font-size:9px;text-transform:uppercase;letter-spacing:.12em}.rail-stat strong{display:block;margin-top:4px;font-size:17px;font-weight:500}.footer{margin:0 22px 18px;height:42px;border:1px solid rgba(246,142,123,.2);background:rgba(8,27,28,.62);border-radius:12px;display:flex;align-items:center;overflow:hidden}.feed-label{height:100%;display:flex;align-items:center;gap:9px;padding:0 15px;color:var(--coral);font-size:10px;letter-spacing:.16em}.feed-label svg{width:14px}.ticker{font-family:ui-monospace,monospace;color:#b8928a;font-size:10px;padding-left:17px;white-space:nowrap}
         .rail-stat{margin:0 0 8px;padding:12px 13px;border:1px solid rgba(161,255,241,.14);border-radius:14px;background:linear-gradient(140deg,rgba(24,56,57,.48),rgba(5,21,30,.58));box-shadow:10px 14px 28px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.12);backdrop-filter:blur(13px)}.wall-plane>.panel.glass{overflow:hidden;padding:20px 22px;background:rgba(10,18,20,.5);border:1px solid rgba(255,255,255,.12);border-radius:18px;box-shadow:0 30px 55px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1),0 0 32px rgba(111,230,189,.12);backdrop-filter:blur(18px)}.wall-plane>.panel.glass:before{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(122deg,rgba(255,255,255,.07) 0%,rgba(255,255,255,0) 30%);pointer-events:none;z-index:0}.wall-plane>.panel.glass:after{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.5) 35%,rgba(255,255,255,0) 70%);pointer-events:none;z-index:2}.wall-plane>.panel.glass>*{position:relative;z-index:1}
        /* Left column spec (2026-09-25): parked work grouped by *why* it's
           stuck, distinct from the swipe-deck look (dropped - grouped cards
           read better stacked, not fanned) */
        .parked-empty{padding:14px;border-radius:13px;background:rgba(7,24,26,.5);border:1px solid rgba(255,255,255,.06);color:#a7c1bd;font-size:10px}
        .parked-groups{display:flex;flex-direction:column;gap:14px;margin-top:4px}
        .parked-group-head{display:flex;align-items:center;gap:6px;color:#9bb3af;font-size:9px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px}.parked-group-head em{margin-left:auto;font-style:normal;color:#6d8684}
        .parked-card{position:relative;padding:10px 11px;border-radius:13px;background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.06);margin-bottom:7px}
        .parked-card-top{display:flex;justify-content:space-between;align-items:center;color:#a7c1bd}
        .parked-card-title{font-size:10px;margin:8px 0 4px;color:#d8e6e3}
        .parked-card-waiting{font-size:9px;color:#8ca2a1;line-height:1.4;margin:0}
        .parked-resume{display:flex;align-items:center;gap:5px;margin-top:8px;border:1px solid rgba(99,225,211,.22);background:rgba(99,225,211,.07);color:var(--teal);border-radius:7px;padding:5px 9px;font-size:9px;cursor:pointer}
        /* Right column spec (2026-09-25): strictly system health, no controls */
        .rail-section-label{color:#6c8685;font-size:9px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 8px}
        .agent-status-row{display:flex;align-items:center;gap:7px;padding:6px 0}
        .agent-dot{width:6px;height:6px;border-radius:50%;background:#5c7472}.agent-dot.online{background:var(--teal);box-shadow:0 0 6px rgba(99,225,211,.6)}.agent-dot.busy{background:var(--amber)}.agent-dot.standby{background:#8ca2a1}.agent-dot.offline{background:#4a5d5b}
        .agent-status-name{font-size:10px;color:#c3d3d0}.agent-status-value{margin-left:auto;font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#76918e}
        .rail-empty{font-size:9px;color:#718987}
        .rail-stat-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)}.rail-stat-row span{color:#76918e;font-size:9px;text-transform:uppercase;letter-spacing:.1em}.rail-stat-row strong{font-size:13px;font-weight:500}
        .rail-scroll{max-height:243px;overflow-y:auto;overflow-x:hidden;padding-right:4px;margin-top:2px}
        .rail-scroll::-webkit-scrollbar{width:4px}.rail-scroll::-webkit-scrollbar-thumb{background:rgba(99,225,211,.25);border-radius:4px}
        /* Center column "current focus + queue" (2026-09-26) */
        .focus-announcement{display:flex;align-items:center;gap:7px;margin-bottom:10px;padding:8px 12px;border-radius:9px;background:rgba(99,225,211,.1);border:1px solid rgba(99,225,211,.25);color:var(--teal);font-size:10px;animation:focus-announce-in .3s ease}
        @keyframes focus-announce-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        .focus-card{position:relative;padding:14px 16px;border-radius:15px;background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.06);margin-bottom:14px}
        .focus-card.needs-input{background:rgba(246,142,123,.08);border-color:rgba(246,142,123,.4);box-shadow:0 0 0 1px rgba(246,142,123,.15)}
        .focus-empty{padding:6px 0;color:#8ca2a1;font-size:10px}
        .focus-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
        .focus-title{font-size:15px;font-weight:600;color:#e8f3f0;margin-top:4px}
        .focus-input-badge{display:flex;align-items:center;gap:5px;padding:5px 9px;border-radius:7px;background:rgba(246,142,123,.15);border:1px solid rgba(246,142,123,.4);color:var(--coral);font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}
        .focus-meta{display:flex;align-items:center;gap:10px;margin-top:9px;flex-wrap:wrap}
        .focus-tag{font-size:9px;text-transform:uppercase;letter-spacing:.08em;font-weight:600}
        .focus-agent,.focus-zdr{display:flex;align-items:center;gap:4px;font-size:9px;color:#9bb3af}
        .focus-reasoning{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)}
        .focus-reasoning p{margin:0;font-size:10px;color:#b8b0e8;line-height:1.45}
        .focus-reasoning-summary{color:#8ca2a1!important}
        .focus-reasoning-empty{color:#718987!important}
        .completions-trail{display:flex;gap:8px;overflow-x:auto;margin-bottom:14px;padding-bottom:4px;-webkit-mask-image:linear-gradient(90deg,#000 85%,transparent)}
        .completion-chip{display:flex;align-items:center;gap:5px;white-space:nowrap;padding:5px 10px;border-radius:20px;background:rgba(99,225,211,.06);border:1px solid rgba(99,225,211,.15);color:#8fb8b1;font-size:9px;flex-shrink:0}
        .completion-chip svg{color:var(--teal)}
        .queue-empty{padding:10px;border-radius:11px;background:rgba(7,24,26,.5);color:#8ca2a1;font-size:10px}
        .queue-list{display:flex;flex-direction:column;gap:6px}
        .queue-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:rgba(7,24,26,.55);border:1px solid rgba(255,255,255,.05);cursor:grab}
        .queue-item.dragging{opacity:.4}
        .queue-item-drag{color:#5c7472;flex-shrink:0}
        .queue-item-title{flex:1;font-size:10px;color:#d8e6e3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .queue-item-tag{font-size:8px;text-transform:uppercase;letter-spacing:.06em;flex-shrink:0}
        .queue-item-agent{display:inline-flex;color:#76918e;flex-shrink:0}
        .queue-fold{display:flex;align-items:center;gap:5px;margin-top:8px;border:0;background:none;color:#76918e;font-size:9px;cursor:pointer;padding:4px 0}
        /* Replit refresh: footer pinned to the wall's own bottom edge
           (was in-flow), so the orb window's own bottom offset and width
           moved from a flat 18px/380px to a responsive figure that
           clears the now-pinned footer bar at every viewport width.
           Pinned via position:absolute against .wall-shell rather than
           position:fixed against the browser viewport - this app wraps
           the wall in a left nav rail Replit's own preview doesn't have,
           so a viewport-relative fixed position/vw-based width drifts
           from .right-cluster's real edges by exactly the rail's width. */
        .footer{position:absolute!important;left:22px;right:22px;bottom:0;margin:0!important;height:42px;z-index:30;border-radius:12px 12px 0 0;background:rgba(8,27,28,.9)}
        .orb-window{position:absolute!important;right:22px!important;bottom:64px!important;width:calc((100% - 44px) * .24 - 10px)!important;max-width:calc(100% - 36px)!important}
        .right-cluster{padding-bottom:58px!important;box-sizing:border-box}
      `}</style>
      <style>{`
        .left-cluster,.right-cluster{transform:none!important}
        .orb-window{position:absolute;right:22px;bottom:18px;width:min(380px,calc(100% - 36px));height:322px;z-index:20;padding:15px 17px 13px;border-radius:17px;background:linear-gradient(140deg,rgba(26,57,69,.93),rgba(10,27,40,.95));border:none;box-shadow:0 20px 44px rgba(0,0,0,.34),inset 0 1px rgba(255,255,255,.3),0 0 40px rgba(99,225,211,.08);backdrop-filter:blur(16px);overflow:hidden}
        .wall-plane{z-index:4}
        .orb-window:before{content:"";position:absolute;inset:-35%;pointer-events:none;background:radial-gradient(circle at 50% 58%,rgba(99,225,211,.12),transparent 28%),radial-gradient(circle at 66% 42%,rgba(169,153,255,.12),transparent 32%);filter:blur(4px)}
        .orb-window-head{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:flex-start}.orb-window-title{font-size:12px;color:#e8f3f0}.orb-window-sub{display:block;margin-top:3px;color:#78908f;font-size:8px}.orb-window-live{color:var(--teal);font-size:8px;border:1px solid rgba(99,225,211,.25);padding:5px 7px;border-radius:7px}
        /* Spacious dark stage for the real animated head asset (2026-10-02,
           replacing the old synthetic sphere) - sized to the available room
           above the chat input/state-row/footer, not the orb-window's own
           380x322 footprint, which is unchanged. Glow colour now carries the
           state signal the old .orb-tint used to (see .orb-stage.<state>
           below) - tinting the head image itself would look unnatural. */
        .orb-stage{position:absolute;left:50%;top:48px;width:200px;height:144px;transform:translateX(-50%);display:grid;place-items:center}
        .orb-stage:before{content:"";position:absolute;inset:-40px;border-radius:50%;background:radial-gradient(circle,rgba(99,225,211,.16),transparent 61%);filter:blur(10px);transition:background .6s ease}
        .orb-stage.listening:before{background:radial-gradient(circle,rgba(99,225,211,.34),transparent 61%)}
        .orb-stage.thinking:before{background:radial-gradient(circle,rgba(169,153,255,.34),transparent 61%)}
        .orb-stage.researching:before{background:radial-gradient(circle,rgba(233,184,114,.3),transparent 61%)}
        .orb-stage.speaking:before{background:radial-gradient(circle,rgba(99,225,211,.3),transparent 61%)}
        .orb-stage.error:before{background:radial-gradient(circle,rgba(246,142,123,.34),transparent 61%)}
        .orb-stage.muted:before{background:radial-gradient(circle,rgba(140,150,150,.1),transparent 61%)}
        /* khameleon-head.webp (726x524, 72-frame animated loop) carries its
           own complete idle/blink/tilt motion - no CSS animation layered on
           top. object-fit:contain preserves aspect ratio with no stretch or
           crop. The translate corrects for the asset's own uneven
           transparent padding (measured across the full loop: ~80px empty
           above the head, ~15px below, roughly centred horizontally) so the
           visible head - not the padded canvas - sits optically centred. */
        .orb-head{width:100%;height:100%;object-fit:contain;transform:translate(1%,-6%);pointer-events:none;user-select:none}
        .orb-state-row{position:absolute;z-index:3;left:15px;right:15px;bottom:77px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}.orb-state{min-width:0;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.035);color:#849e9a;border-radius:7px;padding:5px 2px;font-size:7px;line-height:1;cursor:pointer;white-space:nowrap}.orb-state.active{color:var(--teal);border-color:rgba(99,225,211,.42);background:rgba(99,225,211,.09)}.orb-state[data-state="thinking"].active{color:var(--violet);border-color:rgba(169,153,255,.42);background:rgba(169,153,255,.09)}.orb-state[data-state="researching"].active{color:var(--amber);border-color:rgba(233,184,114,.42);background:rgba(233,184,114,.09)}.orb-state[data-state="error"].active{color:var(--coral);border-color:rgba(246,142,123,.42);background:rgba(246,142,123,.09)}
        .orb-chat{position:absolute;z-index:4;left:15px;right:15px;bottom:39px;height:29px;display:flex;align-items:center;gap:7px;padding:3px 4px 3px 10px;border:1px solid rgba(161,255,241,.2);border-radius:9px;background:rgba(4,19,28,.62);box-shadow:inset 0 1px rgba(255,255,255,.1)}
        .orb-chat input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#d9f4ee;font:9px ui-sans-serif,system-ui,sans-serif}.orb-chat input::placeholder{color:#718b89}.orb-chat button{width:22px;height:22px;display:grid;place-items:center;border:1px solid rgba(99,225,211,.32);border-radius:6px;background:rgba(99,225,211,.1);color:var(--teal);cursor:pointer}.orb-chat button:disabled{opacity:.4;cursor:not-allowed}.orb-chat svg{width:11px;height:11px}
        .orb-window-footer{position:absolute;left:15px;right:15px;bottom:13px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;color:#78908f;font:7px ui-monospace,monospace;letter-spacing:.03em}.orb-window-footer span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.orb-window-footer b{color:var(--teal);font-weight:500;white-space:nowrap}
        @media (min-width:901px){
          .left-cluster{left:0;width:calc(24% - 10px)}
          .center-cluster{left:calc(24% + 10px);width:calc(52% - 20px)}
          .right-cluster{right:0;left:auto;width:calc(24% - 10px)}
        }
      `}</style>
      <div className="space-field" aria-hidden="true"/><div className="reflection-plane" aria-hidden="true"/>
      <header className="topbar glass">
        <div className="brand"><span className="brand-mark"><i/><i/><i/></span><span className="wordmark">KHAMELEON<small>LIVE WALL / ORGANISATIONAL SIGNAL</small></span></div>
        <nav className="nav"><button>Work mode</button><button className="active">Overview</button><button>Agents</button><button>Research</button></nav>
        <div className="top-right">
          <button type="button" className={`bar-btn live ${isLive ? "" : "paused"}`} onClick={() => setIsLive(!isLive)} title={isLive ? "Live - click to pause" : "Paused - click to resume"} aria-label={isLive ? "Pause wall" : "Resume wall"}>
            {isLive ? <Play size={14}/> : <Pause size={14}/>}{topBarLabeled && <span>{isLive ? "Live" : "Paused"}</span>}
          </button>
          <div className="bar-menu">
            <button type="button" className="bar-btn chip" onClick={() => { setModeMenuOpen(v => !v); setDomainMenuOpen(false); }} title={`Orchestration mode: ${mode}`} aria-label="Change orchestration mode">
              <span className="bar-chip-abbr">{MODE_ABBR[mode]}</span>{topBarLabeled && <span>{mode}</span>}<ChevronDown size={11}/>
            </button>
            {modeMenuOpen && <div className="bar-pop glass">{(["Single","Parallel","Vote","Council"] as Mode[]).map(m => <button key={m} type="button" className={mode === m ? "active" : ""} onClick={() => { setMode(m); setModeMenuOpen(false); }}><span className="bar-chip-abbr">{MODE_ABBR[m]}</span>{m}</button>)}</div>}
          </div>
          <div className="bar-menu">
            <button type="button" className="bar-btn" onClick={() => { setDomainMenuOpen(v => !v); setModeMenuOpen(false); }} title="Filter by Work Domain" aria-label="Filter by Work Domain">
              <Filter size={14}/>{topBarLabeled && <span>Domains</span>}{activeDomains.size > 0 && <span className="bar-badge">{activeDomains.size}</span>}
            </button>
            {domainMenuOpen && <div className="bar-pop glass">
              <button type="button" className={activeDomains.size === 0 ? "active" : ""} onClick={() => setActiveDomains(new Set())}>All domains</button>
              {CATEGORIES.map(c => <button key={c} type="button" className={activeDomains.has(c) ? "active" : ""} onClick={() => setActiveDomains(prev => { const next = new Set(prev); next.has(c) ? next.delete(c) : next.add(c); return next; })}>{CATEGORY_LABELS[c]}{byCategory[c] ? ` · ${byCategory[c]}` : ""}</button>)}
            </div>}
          </div>
          <button type="button" className="bar-btn" onClick={() => setShowReasoning(!showReasoning)} title={showReasoning ? "Reasoning expanded by default - click to collapse" : "Reasoning collapsed by default - click to expand"} aria-label="Toggle default reasoning visibility">
            {showReasoning ? <Eye size={14}/> : <EyeOff size={14}/>}{topBarLabeled && <span>Reasoning</span>}
          </button>
          <div className="bar-menu">
            <button type="button" className="bar-btn" onClick={() => { setActivityOpen(true); setModeMenuOpen(false); setDomainMenuOpen(false); }} title="Activity feed" aria-label="Open activity feed">
              <Bell size={14}/>{topBarLabeled && <span>Activity</span>}{agentHistory.length > 0 && <span className="bar-badge">{Math.min(agentHistory.length, 9)}</span>}
            </button>
          </div>
        </div>
      </header>
      {activityOpen && createPortal(
        // .wall-shell sets isolation:isolate, trapping any z-index inside its
        // own stacking context - a fixed-position slideout meant to sit above
        // the whole app (including the outer shell's own header) has to
        // render outside it entirely, the same way JarvisOrbPortal does.
        <div className="activity-scrim" onClick={() => setActivityOpen(false)}>
          <aside className="activity-slideout glass" onClick={e => e.stopPropagation()}>
            <div className="activity-slideout-head"><strong>Activity feed</strong><button type="button" onClick={() => setActivityOpen(false)} aria-label="Close activity feed"><X size={16}/></button></div>
            {agentHistory.length === 0 ? <p className="activity-empty">No recent activity — query Khameleon to begin.</p> : agentHistory.map(ev => (
              <div className="activity-slideout-item" key={ev.id}>
                <div className="activity-slideout-top"><b>{ev.agent}</b><span>{timeAgo(new Date(ev.ts).toISOString())}</span></div>
                <p>{ev.prompt}</p>
              </div>
            ))}
          </aside>
        </div>,
        document.body,
      )}
      <section className="wall-plane">
        <article className="panel glass left-cluster">
          <div className="panel-head"><div><div className="eyebrow">Parked / 01</div><div className="panel-title">Parked <span>orbit</span></div></div><div className="status-pill"><Archive size={12}/>{allParked.length} held</div></div>
          {allParked.length === 0 ? (
            <div className="parked-empty"><p>No blocked or unstarted tasks right now.</p></div>
          ) : (
            <div className="parked-groups">
              {(["external_input","deferred","dependency"] as ParkedReason[]).map(reason => {
                const items = parkedByReason[reason];
                if (items.length === 0) return null;
                const Icon = PARKED_REASON_ICONS[reason];
                return (
                  <div className="parked-group" key={reason}>
                    <div className="parked-group-head"><Icon size={12}/><span>{PARKED_REASON_LABELS[reason]}</span><em>{items.length}</em></div>
                    {items.map(task => (
                      <div className="parked-card" key={task.id}>
                        <div className="parked-card-top"><span className="micro" style={{ color: CATEGORY_ACCENTS[task.category] }}>{CATEGORY_LABELS[task.category].toUpperCase()}</span><GripVertical size={13}/></div>
                        <p className="parked-card-title">{task.title}</p>
                        <p className="parked-card-waiting">
                          {reason === "dependency"
                            ? (task.blockedByTaskId != null && taskById.get(task.blockedByTaskId) ? `Needs "${taskById.get(task.blockedByTaskId)!.title}" done first` : "Waiting on another task")
                            : (task.waitingOn ? `Waiting on ${task.waitingOn}${task.waitingSince ? `, sent ${fmtSentDate(task.waitingSince)}` : ""}` : "Waiting — no detail recorded")}
                        </p>
                        <button type="button" className="parked-resume" onClick={() => void resumeParkedTask(task)}><RotateCcw size={11}/>Resume</button>
                      </div>
                    ))}
                  </div>
                );
              })}
              {unsortedParked.length > 0 && (
                <div className="parked-group">
                  <div className="parked-group-head"><Archive size={12}/><span>Unsorted (no reason recorded)</span><em>{unsortedParked.length}</em></div>
                  {unsortedParked.map(task => (
                    <div className="parked-card" key={task.id}>
                      <div className="parked-card-top"><span className="micro" style={{ color: CATEGORY_ACCENTS[task.category] }}>{CATEGORY_LABELS[task.category].toUpperCase()}</span><GripVertical size={13}/></div>
                      <p className="parked-card-title">{task.title}</p>
                      <p className="parked-card-waiting">{task.status === "blocked" ? "Blocked — reason not yet tagged" : "Not started"}</p>
                      <button type="button" className="parked-resume" onClick={() => void resumeParkedTask(task)}><RotateCcw size={11}/>Resume</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="mission"><div className="mission-top"><strong>Parked capacity</strong><span className="micro" style={{ color: "#e9b872" }}>{allParked.length} held</span></div><p>Held work stays spatially close, without competing with the active stream.</p></div>
        </article>

        <article className="panel glass center-cluster">
          <div className="panel-head"><div><div className="eyebrow">Live orchestration / 02</div><div className="panel-title">Work in <span>motion</span></div></div></div>

          {focusAnnouncement && <div className="focus-announcement"><Sparkles size={12}/>{focusAnnouncement}</div>}

          {/* Center column spec (2026-09-26): current focus (hero, one task,
              full detail) + queue (compact ordered list of what's next) -
              replacing the old domain-filtered task grid now that domain
              filtering and orchestration mode both live in the top bar.
              executingAgentId/zdrEndpoint are real fields but nothing in the
              task-execution pipeline auto-populates them yet (same honest
              caveat as parkedReason) - they render only when actually set. */}
          <div className={`focus-card ${focusTask?.status === "needs_input" ? "needs-input" : ""}`}>
            {!focusTask ? (
              <div className="focus-empty"><p>Nothing in focus right now{queueTasks.length > 0 ? " — promoting the next queued task…" : "."}</p></div>
            ) : (
              <>
                <div className="focus-head">
                  <div><div className="eyebrow">Current focus</div><div className="focus-title">{focusTask.title}</div></div>
                  {focusTask.status === "needs_input" && <span className="focus-input-badge"><AlertTriangle size={12}/>Needs your input</span>}
                </div>
                <div className="focus-meta">
                  <span className="focus-tag" style={{ color: CATEGORY_ACCENTS[focusTask.category] }}>{CATEGORY_LABELS[focusTask.category]}</span>
                  {agentName(focusTask.executingAgentId) && <span className="focus-agent"><Bot size={11}/>{agentName(focusTask.executingAgentId)}</span>}
                  {focusTask.zdrEndpoint && <span className="focus-zdr"><LockKeyhole size={11}/>ZDR</span>}
                </div>
                <div className="focus-reasoning">
                  {showReasoning ? (
                    focusTask.aiRecommendation ? <p>{focusTask.aiRecommendation}</p> : <p className="focus-reasoning-empty">No reasoning trace recorded for this task yet.</p>
                  ) : (
                    <p className="focus-reasoning-summary">{focusTask.aiRecommendation ? `${focusTask.aiRecommendation.slice(0, 80)}${focusTask.aiRecommendation.length > 80 ? "…" : ""}` : "Reasoning collapsed — toggle in the top bar to expand."}</p>
                  )}
                </div>
              </>
            )}
          </div>

          {sortedRecentDone.length > 0 && (
            <div className="completions-trail">
              {sortedRecentDone.map(t => <span className="completion-chip" key={t.id}><CheckCircle2 size={10}/>{t.title}</span>)}
            </div>
          )}

          <div className="queue-section">
            <div className="route-head"><div><strong>Queue</strong><span>{queueTasks.length} up next{activeDomains.size > 0 ? ` · filtered to ${activeDomains.size} domain${activeDomains.size > 1 ? "s" : ""}` : ""}</span></div></div>
            {queueTasks.length === 0 ? (
              <div className="queue-empty">Nothing queued.</div>
            ) : (
              <>
                <div className="queue-list">
                  {(queueExpanded ? queueTasks : queueTasks.slice(0, 4)).map(task => (
                    <div
                      className={`queue-item ${draggedQueueId === task.id ? "dragging" : ""}`}
                      key={task.id}
                      draggable
                      onDragStart={() => setDraggedQueueId(task.id)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); if (draggedQueueId != null) void reorderQueue(draggedQueueId, task.id); setDraggedQueueId(null); }}
                      onDragEnd={() => setDraggedQueueId(null)}
                    >
                      <GripVertical size={13} className="queue-item-drag"/>
                      <span className="queue-item-title">{task.title}</span>
                      <span className="queue-item-tag" style={{ color: CATEGORY_ACCENTS[task.category] }}>{CATEGORY_LABELS[task.category]}</span>
                      {agentName(task.executingAgentId) && <span className="queue-item-agent" title={agentName(task.executingAgentId) ?? undefined}><Bot size={12}/></span>}
                    </div>
                  ))}
                </div>
                {queueTasks.length > 4 && (
                  <button type="button" className="queue-fold" onClick={() => setQueueExpanded(v => !v)}>
                    {queueExpanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                    {queueExpanded ? "Show less" : `+${queueTasks.length - 4} more`}
                  </button>
                )}
              </>
            )}
          </div>
        </article>

        <article className="panel glass right-cluster">
          <div className="panel-head"><div><div className="eyebrow">Signal cluster / 03</div><div className="panel-title">Wall <span>status</span></div></div><div className="status-pill"><Radio size={12}/>{isLive ? "Live" : "Held"}</div></div>
          {/* Right column spec (2026-09-25): strictly system health, no
              controls, nothing representing work being done. Connected
              agents = real per-agent online/offline (agentsApi.getAgentStatus);
              no rate-limit/quota shown since nothing in this app tracks it -
              omitted rather than invented. ZDR is the single global indicator
              (moved from the center panel's old per-panel badge - there's no
              per-task ZDR field to break it down further honestly).
              Everything below panel-head is one bounded, independently
              scrollable region: right-cluster sits directly above the
              (bottom-anchored, overlaying) orb window, so unbounded content
              here would render underneath it rather than push it down - this
              was already quietly true of the old 3-stat + mission-card
              content before today's additions, just not visible until now. */}
          <div className="rail-scroll">
            <div className="rail-stat-row"><span>Total queries</span><strong style={{ color: "#63e1d3" }}>{health?.total_queries ?? 0}</strong></div>
            <div className="rail-stat-row"><span>Avg latency</span><strong>{fmtMs(health?.avg_latency_ms)}</strong></div>
            <div className="rail-stat-row"><span>Uptime</span><strong>{fmtUptime(health?.uptime ?? 0)}</strong></div>

            <div className="rail-section-label" style={{ marginTop: 12 }}>Connected agents</div>
            {roster.slice(0, 4).map(a => (
              <div className="agent-status-row" key={a.id}>
                <span className={`agent-dot ${agentStatuses[a.id] ?? "offline"}`}/>
                <span className="agent-status-name">{a.name}</span>
                <span className="agent-status-value">{agentStatuses[a.id] ?? "offline"}</span>
              </div>
            ))}
            <div className="privacy" style={{ marginTop: 8 }}><LockKeyhole size={13}/>ZDR endpoint active</div>

            <div className="rail-section-label" style={{ marginTop: 12 }}>Integrations</div>
            {connectors.length === 0 ? <p className="rail-empty">No connectors configured yet.</p> : connectors.slice(0, 4).map(c => (
              <div className="agent-status-row" key={c.id}>
                <Plug size={11} color={c.connected ? "#63e1d3" : "#f68e7b"}/>
                <span className="agent-status-name">{c.name}</span>
                <span className="agent-status-value" style={{ color: c.connected ? "#63e1d3" : "#f68e7b" }}>{c.connected ? "connected" : "disconnected"}</span>
              </div>
            ))}

            <div className="mission" style={{ marginTop: 12 }}>
              <div className="mission-top"><strong>Today's progress</strong><Timer size={15} color="#e9b872"/></div>
              <p><b style={{ fontSize: 18 }}>{doneTasks}/{totalTasks}</b> tasks completed today.</p>
            </div>
          </div>
        </article>
      </section>

      {/* Sibling of .wall-plane (not nested inside it) so its %-based
          right/width resolve against .wall-shell's own real box - .wall-shell
          renders narrower than 100vw inside this app (a left nav rail eats
          into the viewport that Replit's own standalone preview didn't have),
          so vw-based sizing here would drift from .right-cluster's actual
          edges the way it did before this fix. */}
      <article className="orb-window">
        <div className="orb-window-head"><div><div className="eyebrow">Khami</div><div className="orb-window-title">Khameleon <span style={{ color: "#63e1d3" }}>presence</span></div><span className="orb-window-sub">One continuous agent · state drives the atmosphere</span></div><span className="orb-window-live">{wallState.toUpperCase()}</span></div>
        <div className={`orb-stage ${wallState}`}>
          <img className="orb-head" src="/khameleon-head.webp" alt="Khameleon" />
        </div>
        <form className="orb-chat" onSubmit={submitChat}>
          <input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder={chatSent ? "Ask another question…" : "Ask Khameleon anything…"} aria-label="Chat with Khameleon" disabled={streaming}/>
          <button type="submit" disabled={!chatDraft.trim() || streaming} aria-label="Send message"><Send/></button>
        </form>
        <div className="orb-state-row">{(["idle","listening","thinking","researching","speaking","error","muted"] as WallOrbState[]).map((state) => <button key={state} type="button" className={`orb-state ${wallState === state ? "active" : ""}`} data-state={state} aria-label={state === "speaking" ? "Play a short Khameleon voice demo" : `Set ${state} state`} onClick={() => selectOrbState(state)}>{state}</button>)}</div>
        <div className="orb-window-footer"><span>{chatSent ? `${streaming ? "PROCESSING" : "SENT"} · ${chatSent.slice(0, 28)}${chatSent.length > 28 ? "…" : ""}` : (orbStatus === "speaking" ? "LIVE VOICE" : "TEXTURE / NEBULA NEUTRAL · LIGHT / REFRACTION ACTIVE")}</span><b>{wallState === "listening" ? "LISTENING" : wallState === "speaking" ? "SPEAKING" : wallState === "thinking" || wallState === "researching" ? "PROCESSING" : wallState === "error" ? "ATTENTION" : "READY"}</b></div>
      </article>
      <footer className="footer"><div className="feed-label"><Radio/>KHAMELEON FEED</div><div className="ticker"><b>{isLive ? "LIVE" : "PAUSED"}</b>　///　{ticker}</div></footer>
    </main>
    </div>
    </div>
  );
}
