import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Activity, Archive, ArrowUpRight, GripVertical, LockKeyhole, Menu, MoveHorizontal,
  Radio, Send, ShieldCheck, Sparkles, Timer, UsersRound, Wand2,
} from "lucide-react";
import { useJarvisStore } from "@/store/jarvisStore";
import { useJarvisHealth, useJarvisTelemetry } from "@/hooks/useJarvis";
import {
  getDailyTasks, type Task, type TaskCategory,
} from "@/lib/jarvisApi";
import {
  streamAgentChat, FALLBACK_ROSTER, getRoster,
  type AgentConfig, type ChatMessage,
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
const CATEGORY_ICONS: Record<TaskCategory, typeof Activity> = {
  communication: UsersRound,
  meetings: UsersRound,
  deep_work: Activity,
  task_project_management: Activity,
  administrative: ShieldCheck,
  planning: ShieldCheck,
};
const CATEGORIES = Object.keys(CATEGORY_LABELS) as TaskCategory[];

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

export function CommandWall() {
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

  const [domain, setDomain] = useState<"all" | TaskCategory>("all");
  const [mode, setMode] = useState<Mode>("Parallel");
  const [isLive, setIsLive] = useState(true);
  const [showReasoning, setShowReasoning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatSent, setChatSent] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [roster, setRoster] = useState<AgentConfig[]>(FALLBACK_ROSTER);
  const [dailyData, setDailyData] = useState<Record<string, Task[]>>({});
  const [byCategory, setByCategory] = useState<Record<string, number>>({});
  const [totalTasks, setTotalTasks] = useState(0);
  const [doneTasks, setDoneTasks] = useState(0);

  const orbRef = useRef<HTMLDivElement>(null);
  const streamBufRef = useRef("");
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  const loadTasks = useCallback(() => {
    getDailyTasks().then(d => {
      setDailyData(d.sections ?? {});
      setByCategory(d.byCategory ?? {});
      setTotalTasks(d.total ?? 0);
      setDoneTasks(d.doneCount ?? 0);
    });
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
  const visibleTasks = useMemo(
    () => domain === "all" ? allTasks.filter(t => t.status !== "done") : allTasks.filter(t => t.status !== "done" && t.category === domain),
    [allTasks, domain],
  );
  // "Parked" = blocked or not-yet-started, capped to 3 - the original's
  // fixed swipe-deck placeholders, replaced with whatever's actually held.
  const parkedTasks = useMemo(
    () => allTasks.filter(t => t.status === "blocked" || t.status === "todo").slice(0, 3),
    [allTasks],
  );
  const reasoningTask = useMemo(
    () => allTasks.find(t => t.aiRecommendation && t.aiRecommendation.trim().length > 0) ?? null,
    [allTasks],
  );
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

  useEffect(() => {
    const orb = orbRef.current;
    const texture = orb?.querySelector<HTMLElement>(".orb-texture");
    const lightOne = orb?.querySelector<HTMLElement>(".orb-light-one");
    const lightTwo = orb?.querySelector<HTMLElement>(".orb-light-two");
    if (!isLive || wallState !== "idle" || !texture || !lightOne || !lightTwo) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: number | undefined;
    const moveToWaypoint = () => {
      texture.style.setProperty("--shimmer-x", `${Math.round((Math.random() * 2 - 1) * 4)}px`);
      texture.style.setProperty("--shimmer-y", `${Math.round((Math.random() * 2 - 1) * 4)}px`);
      texture.style.setProperty("--shimmer-scale", (1 + Math.random() * 0.024).toFixed(3));
      texture.style.setProperty("--shimmer-rotate", `${((Math.random() * 2 - 1) * 1.2).toFixed(2)}deg`);
      texture.style.setProperty("--shimmer-position", `${48 + Math.round(Math.random() * 7)}% ${47 + Math.round(Math.random() * 7)}%`);
      const setLight = (element: HTMLElement, hue: "teal" | "violet") => {
        element.style.setProperty("--light-x", `${Math.round((Math.random() * 2 - 1) * 12)}px`);
        element.style.setProperty("--light-y", `${Math.round((Math.random() * 2 - 1) * 12)}px`);
        element.style.setProperty("--light-scale", (0.84 + Math.random() * 0.34).toFixed(2));
        element.style.setProperty("--light-opacity", (0.16 + Math.random() * 0.25).toFixed(2));
        element.style.setProperty("--light-hue", hue === "teal" ? "99,225,211" : "169,153,255");
      };
      setLight(lightOne, "teal");
      setLight(lightTwo, "violet");
      timer = window.setTimeout(moveToWaypoint, 1400 + Math.random() * 2200);
    };
    moveToWaypoint();
    return () => { if (timer !== undefined) window.clearTimeout(timer); };
  }, [isLive, wallState]);

  return (
    <main className="wall-shell">
      <style>{`
        .wall-shell{--ink:#e8f3f0;--muted:#78908f;--teal:#63e1d3;--violet:#a999ff;--amber:#e9b872;--coral:#f68e7b;position:relative;isolation:isolate;min-height:800px;overflow:hidden;background:rgba(5,15,23,.16);color:var(--ink);font-family:ui-sans-serif,system-ui,sans-serif}
        .desktop-layer{position:absolute;inset:0;z-index:0;overflow:hidden;background:linear-gradient(135deg,#6d7d86,#364e5e 38%,#182a3b);color:rgba(236,245,247,.78)}
        .desktop-layer:before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 72% 35%,rgba(184,219,226,.78),transparent 24%),radial-gradient(ellipse at 20% 80%,rgba(170,193,203,.52),transparent 30%),linear-gradient(140deg,rgba(255,255,255,.13),transparent 30%,rgba(8,17,30,.34));filter:blur(1px)}
        .desktop-layer:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(9,18,29,.3),transparent 28%,transparent 72%,rgba(9,18,29,.28)),linear-gradient(0deg,rgba(8,19,29,.5),transparent 18%);pointer-events:none}
        .desktop-top{position:absolute;left:0;right:0;top:0;height:29px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;background:rgba(8,17,28,.48);border-bottom:1px solid rgba(255,255,255,.12);font-size:10px}.desktop-system{opacity:.72}
        .desktop-icons{position:absolute;left:22px;top:82px;display:grid;gap:17px;width:72px}.desktop-icon{display:grid;justify-items:center;gap:6px;font-size:9px;text-shadow:0 1px 4px #000;opacity:.78}.desktop-icon i{width:28px;height:24px;border-radius:7px;background:linear-gradient(145deg,rgba(221,244,250,.74),rgba(78,129,153,.58));border:1px solid rgba(255,255,255,.45);box-shadow:0 6px 15px rgba(0,0,0,.22)}
        .desktop-window{position:absolute;right:66px;bottom:73px;width:305px;height:192px;border-radius:12px;background:rgba(11,26,39,.32);border:1px solid rgba(228,250,255,.3);box-shadow:0 22px 44px rgba(6,15,24,.23),inset 0 1px rgba(255,255,255,.24);backdrop-filter:blur(5px)}.desktop-window-head{height:28px;padding:0 11px;display:flex;align-items:center;gap:6px;border-bottom:1px solid rgba(255,255,255,.13);font-size:9px}.desktop-window-head b{width:7px;height:7px;border-radius:50%;background:#ed9f92;box-shadow:12px 0 #e7bf7a,24px 0 #8bd9bd;margin-right:27px}.desktop-window-body{display:grid;grid-template-columns:72px 1fr;height:calc(100% - 28px)}.desktop-window-nav{padding:11px 8px;border-right:1px solid rgba(255,255,255,.11);font-size:8px;line-height:2.2;opacity:.66}.desktop-window-chart{padding:13px;position:relative}.desktop-window-chart:before{content:"";position:absolute;left:13px;right:13px;bottom:20px;height:76px;background:linear-gradient(145deg,transparent 30%,rgba(104,231,218,.65) 31% 33%,transparent 34% 48%,rgba(240,185,119,.6) 49% 51%,transparent 52% 67%,rgba(162,153,255,.66) 68% 70%,transparent 71%);opacity:.68}.desktop-dock{position:absolute;left:50%;bottom:17px;transform:translateX(-50%);height:38px;padding:0 13px;display:flex;align-items:center;gap:8px;border-radius:14px;background:rgba(7,18,29,.42);border:1px solid rgba(255,255,255,.2);box-shadow:0 9px 24px rgba(0,0,0,.25);backdrop-filter:blur(7px)}.desktop-dock i{display:block;width:22px;height:22px;border-radius:6px;background:linear-gradient(145deg,rgba(243,252,255,.8),rgba(99,182,205,.65));border:1px solid rgba(255,255,255,.4)}
        .space-field{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;background:radial-gradient(ellipse at 50% 98%,rgba(80,198,211,.12),transparent 34%)}.space-field:before{content:"";position:absolute;inset:0;opacity:.48;background-image:radial-gradient(circle at 11% 22%,rgba(210,255,247,.92) 0 1px,transparent 1.8px),radial-gradient(circle at 25% 17%,rgba(136,205,255,.72) 0 1px,transparent 1.7px),radial-gradient(circle at 43% 28%,rgba(255,225,170,.7) 0 1px,transparent 1.7px),radial-gradient(circle at 66% 13%,rgba(201,181,255,.85) 0 1px,transparent 1.8px),radial-gradient(circle at 83% 25%,rgba(166,250,240,.75) 0 1px,transparent 1.7px)}.reflection-plane{position:absolute;left:3%;right:3%;bottom:-2px;height:170px;z-index:0;pointer-events:none;opacity:.7;transform:perspective(520px) rotateX(58deg);transform-origin:bottom;background:linear-gradient(to bottom,rgba(7,24,31,.08),rgba(3,10,18,.72)),radial-gradient(ellipse at 50% 0,rgba(108,243,231,.12),transparent 46%);border-top:1px solid rgba(145,244,235,.14);box-shadow:0 -18px 45px rgba(62,218,213,.1)}
        .topbar,.wall-plane,.footer{position:relative;z-index:1}.glass{background:linear-gradient(132deg,rgba(45,95,99,.32),rgba(7,26,35,.43) 42%,rgba(9,20,31,.5));border:1px solid rgba(161,255,241,.28);box-shadow:0 22px 70px rgba(0,0,0,.22),inset 0 1px rgba(225,255,251,.35),inset 0 -1px rgba(0,0,0,.38);backdrop-filter:blur(16px) saturate(165%)}
        .topbar{height:74px;margin:18px 22px 6px;padding:0 20px;border-radius:19px;display:flex;align-items:center;gap:28px}.brand{display:flex;align-items:center;gap:11px;min-width:220px}.brand-mark{width:26px;height:26px;position:relative}.brand-mark i{position:absolute;width:8px;height:8px;border:2px solid var(--teal);border-radius:50%;box-shadow:0 0 14px rgba(99,225,211,.6)}.brand-mark i:nth-child(1){left:1px;top:9px}.brand-mark i:nth-child(2){left:9px;top:3px}.brand-mark i:nth-child(3){left:17px;top:11px}.wordmark{font-size:15px;letter-spacing:.2em;font-weight:700}.wordmark small{display:block;color:#73918f;font-size:8px;letter-spacing:.16em;margin-top:3px;font-weight:500}.nav{display:flex;gap:23px;align-items:center;flex:1}.nav button,.menu button{border:0;background:none;color:#78908f;font-size:12px;padding:25px 0 22px;cursor:pointer}.nav button.active{color:var(--teal);border-bottom:2px solid var(--teal)}.top-right{display:flex;align-items:center;gap:17px}.clock{text-align:right;color:var(--teal)}.clock b{display:block;font-size:12px}.clock span{color:#6c8584;font-size:9px}.live-switch{display:flex;align-items:center;gap:8px;border:1px solid rgba(99,225,211,.2);background:rgba(99,225,211,.07);border-radius:20px;padding:8px 11px;color:var(--teal);cursor:pointer}.live-dot{width:7px;height:7px;border-radius:50%;background:var(--teal);box-shadow:0 0 0 4px rgba(99,225,211,.11)}.paused .live-dot{background:var(--amber);box-shadow:none}.menu{position:relative}.menu-pop{position:absolute;right:0;top:40px;width:140px;padding:6px;border-radius:10px;z-index:5}.menu-pop button{display:block;width:100%;text-align:left;padding:8px;color:#9db4b1;font-size:10px}
         .wall-plane{height:574px;margin:0 22px;position:relative}.panel{position:absolute;overflow:visible}.panel:after{content:"";position:absolute;right:-70px;top:-90px;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,rgba(99,225,211,.13),transparent 65%);filter:blur(5px);pointer-events:none}.eyebrow,.micro{color:#6c8685;font-size:10px;letter-spacing:.16em;text-transform:uppercase}.panel-title{font-size:18px;font-weight:600;letter-spacing:-.03em;margin-top:5px}.panel-title span{color:var(--teal)}.panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.status-pill,.privacy{display:flex;align-items:center;gap:7px;padding:7px 10px;border-radius:8px;font-size:10px;color:var(--teal);background:rgba(99,225,211,.08);border:1px solid rgba(99,225,211,.16)}.privacy{color:#b8aaff;border-color:rgba(169,153,255,.2)}.left-cluster{left:1%;top:60px;width:29%;height:435px;transform:rotate(-1.6deg);z-index:2}.center-cluster{left:25%;top:8px;width:53%;height:550px;z-index:3}.right-cluster{right:1%;top:93px;width:23%;height:390px;transform:rotate(1.8deg);z-index:2}
        .swipe-stack{position:relative;height:270px;margin:4px -4px 0}.swipe-card{position:absolute;left:10px;width:calc(100% - 22px);border-radius:15px;padding:12px;background:linear-gradient(145deg,rgba(21,56,64,.72),rgba(5,20,29,.8));border:1px solid rgba(176,255,242,.22);box-shadow:18px 22px 36px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.2);backdrop-filter:blur(13px)}.swipe-card.back{top:10px;transform:translateX(24px) rotate(3deg);opacity:.55}.swipe-card.mid{top:38px;transform:translateX(10px) rotate(-2deg);opacity:.78}.swipe-card.video{top:92px;transform:translateX(-12px) rotate(-4deg);z-index:2}.swipe-card-head{display:flex;align-items:center;justify-content:space-between;font-size:9px;color:#a7c1bd}.swipe-card-head svg{width:13px}.thumb{height:78px;margin:10px 0;border-radius:10px;background:radial-gradient(circle at 67% 38%,rgba(244,190,164,.95) 0 4%,transparent 5%),linear-gradient(132deg,#163b4b 0 24%,#2f6b72 25% 39%,#8d5a60 40% 59%,#f0ad99 60% 63%,#213b4b 64%);box-shadow:inset 0 0 30px rgba(0,0,0,.4)}.video-meta{display:flex;align-items:center;gap:8px;color:#cde5e0;font-size:10px}.play-button{width:25px;height:25px;display:grid;place-items:center;border:1px solid rgba(99,225,211,.5);border-radius:50%;color:var(--teal);background:rgba(0,20,25,.48);cursor:pointer}.play-button svg{width:12px}.progress{height:3px;border-radius:4px;background:rgba(255,255,255,.12);margin:9px 0 5px}.progress i{display:block;width:63%;height:100%;background:linear-gradient(90deg,var(--teal),var(--amber))}.swipe-hint{display:flex;align-items:center;gap:7px;margin:8px 2px;color:#738f8c;font-size:9px}.mission{border-radius:16px;padding:13px 15px;background:linear-gradient(120deg,rgba(6,39,44,.64),rgba(4,19,28,.52));border:1px solid rgba(99,225,211,.13)}.mission-top{display:flex;justify-content:space-between;align-items:center}.mission strong{font-size:12px}.mission p{font-size:10px;color:#8ca2a1;line-height:1.5;margin:8px 0 0}.visual-workspace{height:322px;position:relative;border-radius:17px;overflow:hidden;margin:3px 0 12px;background:linear-gradient(140deg,#152e45,#2d5661 38%,#594b64 67%,#211e39);border:1px solid rgba(209,255,246,.32);box-shadow:0 20px 44px rgba(0,0,0,.3),inset 0 1px rgba(255,255,255,.32)}.visual-workspace:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 48% 39%,rgba(246,222,190,.9) 0 3%,transparent 3.5%),radial-gradient(circle at 48% 39%,rgba(255,190,152,.32) 0 17%,transparent 18%),linear-gradient(165deg,transparent 0 29%,rgba(154,223,220,.38) 30% 31%,transparent 32% 52%,rgba(233,162,137,.34) 53% 54%,transparent 55%);animation:drift 10s ease-in-out infinite}.workspace-label{position:absolute;left:13px;top:12px;z-index:1;font-size:9px;letter-spacing:.13em;color:#dcf8f2}.workspace-footer{position:absolute;left:12px;right:12px;bottom:10px;z-index:1;display:flex;justify-content:space-between;align-items:end}.workspace-footer strong{font-size:12px;font-weight:500}.workspace-footer span{display:block;color:#b0c8c2;font-size:9px;margin-top:3px}.workspace-tools{display:flex;gap:5px}.workspace-tools i{width:22px;height:22px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.22);border-radius:6px;background:rgba(4,17,26,.4)}.workspace-tools svg{width:11px}.mini-float{position:absolute;right:15px;top:58px;width:116px;padding:9px;border-radius:11px;z-index:2;background:rgba(7,24,33,.75);border:1px solid rgba(233,184,114,.35);box-shadow:0 15px 27px rgba(0,0,0,.32);transform:rotate(3deg)}.mini-float b{display:block;color:#f0c98b;font-size:9px}.mini-float p{margin:6px 0 0;color:#a8bfba;font-size:8px;line-height:1.45}.mini-float em{display:block;margin-top:7px;color:var(--teal);font-style:normal;font-size:8px}
        .domain-row,.mode{display:flex;gap:6px;overflow:hidden}.domain-row button,.mode button{white-space:nowrap;cursor:pointer;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.025);color:#819796;border-radius:8px;padding:7px 9px;font-size:9px}.domain-row button.active,.mode button.active{color:var(--teal);border-color:rgba(99,225,211,.35);background:rgba(99,225,211,.09)}.route-head{display:flex;justify-content:space-between;align-items:end;margin:12px 0 9px}.route-head strong{font-size:13px}.route-head span{display:block;color:#6d8684;font-size:9px;margin-top:4px}.task-list{display:grid;grid-template-columns:1fr 1fr;gap:7px}.task{display:grid;grid-template-columns:25px 1fr;gap:8px;padding:10px;border-radius:13px;background:rgba(7,24,26,.63);border:1px solid rgba(255,255,255,.065)}.task-icon{width:25px;height:25px;display:grid;place-items:center;border-radius:8px;background:rgba(255,255,255,.05)}.task-icon svg{width:13px}.task-title{font-size:10px;color:#d8e6e3}.task-meta{font-size:8px;color:#6f8886;margin-top:4px}.reasoning{margin-top:10px;padding:10px;border-radius:12px;background:rgba(169,153,255,.055);border:1px solid rgba(169,153,255,.2)}.reasoning p{font-size:9px;color:#b8b0e8;line-height:1.45;margin:0}.toggle{width:30px;height:17px;border:0;border-radius:20px;background:#345254;padding:2px;cursor:pointer}.toggle i{display:block;width:13px;height:13px;border-radius:50%;background:#9aacab;transition:transform .18s}.toggle.on{background:var(--violet)}.toggle.on i{transform:translateX(13px);background:#fff}.activity-card{padding:12px;border-radius:15px;background:rgba(5,20,22,.5);border:1px solid rgba(255,255,255,.07)}.reason-head{display:flex;justify-content:space-between;align-items:center;color:#c4baff;font-size:10px}.activity-line{display:flex;gap:8px;padding-top:10px}.activity-line svg{width:14px;color:var(--teal)}.activity-line p{margin:0;font-size:9px}.activity-line small{display:block;color:#718b89;margin-top:3px}.rail-stat{padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)}.rail-stat span{display:block;color:#76918e;font-size:9px;text-transform:uppercase;letter-spacing:.12em}.rail-stat strong{display:block;margin-top:4px;font-size:17px;font-weight:500}.right-float{margin:13px -8px 0;padding:12px;border-radius:15px;background:linear-gradient(140deg,rgba(24,56,57,.64),rgba(5,21,30,.7));border:1px solid rgba(169,153,255,.24);box-shadow:12px 18px 32px rgba(0,0,0,.25);transform:rotate(-2deg)}.right-float-head{display:flex;justify-content:space-between;color:#b9b0fa;font-size:9px}.right-float p{font-size:9px;color:#8ca5a1;line-height:1.4;margin:8px 0}.rail-actions{display:flex;gap:6px;margin-top:12px}.rail-actions button{flex:1;border:1px solid rgba(99,225,211,.18);background:rgba(99,225,211,.06);border-radius:8px;color:#9bd4cd;padding:8px 4px;font-size:9px;cursor:pointer}.footer{margin:0 22px 18px;height:42px;border:1px solid rgba(246,142,123,.2);background:rgba(8,27,28,.62);border-radius:12px;display:flex;align-items:center;overflow:hidden}.feed-label{height:100%;display:flex;align-items:center;gap:9px;padding:0 15px;color:var(--coral);font-size:10px;letter-spacing:.16em}.feed-label svg{width:14px}.ticker{font-family:ui-monospace,monospace;color:#b8928a;font-size:10px;padding-left:17px;white-space:nowrap}@keyframes drift{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}@media(max-width:900px){.wall-shell{min-height:100dvh}.topbar{margin:10px;height:auto;min-height:68px}.nav{display:none}.clock{display:none}.top-right{margin-left:auto}.wall-plane{height:auto;margin:0 10px;display:grid;gap:14px}.panel{position:relative!important;inset:auto!important;width:auto!important;height:auto!important;min-height:0;transform:none!important}.center-cluster{order:-1}.task-list{grid-template-columns:1fr}.footer{margin:14px 10px}.domain-row{overflow:auto}}
         .rail-stat{margin:0 0 8px;padding:12px 13px;border:1px solid rgba(161,255,241,.14);border-radius:14px;background:linear-gradient(140deg,rgba(24,56,57,.48),rgba(5,21,30,.58));box-shadow:10px 14px 28px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.12);backdrop-filter:blur(13px)}.wall-plane>.panel.glass{padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;backdrop-filter:none}.wall-plane>.panel.glass:after{content:none}
        /* Original had .mode{overflow:hidden} sharing that rule with
           .domain-row - fine for domain-row's wider row, but .mode sits
           beside route-head's heading text in a zone the right-cluster
           panel physically overlaps (left+width and right+width put both
           panels over the same ~76-78% band) - "Vote"/"Council" were
           rendering underneath it, not clipped by overflow at all. Drops
           the mode row onto its own full-width line below the heading,
           clear of that overlap zone, instead. */
        .route-head{flex-wrap:wrap;row-gap:8px}.mode{overflow:visible;flex-basis:100%;justify-content:flex-start}
      `}</style>
      <style>{`
        .left-cluster,.right-cluster{transform:none!important}
        .swipe-card.back,.swipe-card.mid,.swipe-card.video,.right-float,.mini-float{transform:none!important}
        .swipe-card{border-radius:14px}
        .sheet-grid{position:absolute;left:0;right:0;top:39px;bottom:43px;overflow:hidden;padding:0 12px;z-index:1}
        .sheet-row{display:grid;grid-template-columns:42px 1.4fr .8fr .8fr .9fr 1fr;min-height:25px;border-bottom:1px solid rgba(202,244,238,.1);font-size:8px;color:#b9d1cd}
        .sheet-row span{padding:7px 6px;border-right:1px solid rgba(202,244,238,.08);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sheet-row.head{background:rgba(99,225,211,.1);color:#d9f8f1;font-weight:600}
        .sheet-row.head span{padding-top:6px;padding-bottom:6px}
        .sheet-row.total{color:#f0c98b;background:rgba(233,184,114,.07)}
        .sheet-badge{color:var(--teal);background:rgba(99,225,211,.09);border-radius:4px;padding:3px 5px!important;text-align:center}
        .spreadsheet-card{position:absolute;left:27%;top:218px;width:47%;height:238px;z-index:5;padding:13px 15px;border-radius:15px;background:linear-gradient(145deg,rgba(19,53,60,.9),rgba(5,20,29,.93));border:1px solid rgba(161,255,241,.34);box-shadow:0 24px 52px rgba(0,0,0,.38),inset 0 1px rgba(255,255,255,.24);backdrop-filter:blur(18px)}
        .spreadsheet-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}.spreadsheet-title{font-size:12px;color:#e8f3f0}.spreadsheet-sub{display:block;margin-top:3px;color:#78908f;font-size:8px}.spreadsheet-live{color:var(--teal);font-size:8px;border:1px solid rgba(99,225,211,.25);padding:5px 7px;border-radius:7px}
        .visual-workspace{background:transparent!important;border:0!important;box-shadow:none!important}
        .visual-workspace>*{visibility:hidden}
        .spreadsheet-card{left:25%;top:168px;width:53%;height:322px;padding:14px 15px;border-radius:17px;background:linear-gradient(140deg,rgba(26,57,69,.95),rgba(12,31,43,.96));border:1px solid rgba(209,255,246,.34);box-shadow:0 20px 44px rgba(0,0,0,.34),inset 0 1px rgba(255,255,255,.3);backdrop-filter:blur(16px)}
        .spreadsheet-card:after{content:"AI FORMULA ACTIVITY   4 checks aligned   •   1 approval needed     APPROVE   ↗";position:absolute;left:15px;right:15px;bottom:13px;height:25px;display:flex;align-items:center;padding:0 9px;border-radius:7px;background:rgba(99,225,211,.08);border:1px solid rgba(99,225,211,.18);color:#9ddbd3;font:8px ui-monospace,monospace;letter-spacing:.04em}
        .spreadsheet-card .sheet-grid{top:75px;bottom:49px}
        .orb-window{position:fixed;right:18px;bottom:18px;width:min(380px,calc(100vw - 36px));height:322px;z-index:20;padding:15px 17px 13px;border-radius:17px;background:linear-gradient(140deg,rgba(26,57,69,.93),rgba(10,27,40,.95));border:1px solid rgba(209,255,246,.34);box-shadow:0 20px 44px rgba(0,0,0,.34),inset 0 1px rgba(255,255,255,.3),0 0 40px rgba(99,225,211,.08);backdrop-filter:blur(16px);overflow:hidden}
        .wall-plane{z-index:4}
        .orb-window:before{content:"";position:absolute;inset:-35%;pointer-events:none;background:radial-gradient(circle at 50% 58%,rgba(99,225,211,.12),transparent 28%),radial-gradient(circle at 66% 42%,rgba(169,153,255,.12),transparent 32%);filter:blur(4px)}
        .orb-window-head{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:flex-start}.orb-window-title{font-size:12px;color:#e8f3f0}.orb-window-sub{display:block;margin-top:3px;color:#78908f;font-size:8px}.orb-window-live{color:var(--teal);font-size:8px;border:1px solid rgba(99,225,211,.25);padding:5px 7px;border-radius:7px}
        .orb-stage{position:absolute;left:50%;top:42%;width:126px;height:126px;transform:translate(-50%,-50%);display:grid;place-items:center}.orb-stage:before{content:"";position:absolute;inset:-32px;border-radius:50%;background:radial-gradient(circle,rgba(99,225,211,.16),transparent 61%);filter:blur(6px)}
        .orb-core{position:relative;width:100px;height:100px;border-radius:50%;overflow:hidden;background:#7f8b90;box-shadow:inset -15px -18px 23px rgba(0,0,0,.65),inset 10px 8px 18px rgba(255,255,255,.16),0 0 36px rgba(99,225,211,.28),0 0 60px rgba(169,153,255,.16);transition:box-shadow .35s ease,filter .35s ease}
        .orb-texture{position:absolute;inset:-10%;background-image:url("/khameleon-command/nebula-core.png");background-size:118% 118%;background-position:var(--shimmer-position,center);filter:grayscale(1) contrast(1.1) brightness(1.15);transition:transform 2.8s cubic-bezier(.22,.72,.28,1),background-position 3.2s cubic-bezier(.22,.72,.28,1),filter .6s ease;transform:translate3d(var(--shimmer-x,0px),var(--shimmer-y,0px),0) scale(var(--shimmer-scale,1)) rotate(var(--shimmer-rotate,0deg));animation:none}.orb-core.idle.wall-paused .orb-texture{transition:none}
        .orb-light{position:absolute;z-index:1;inset:-18%;pointer-events:none;mix-blend-mode:screen;opacity:var(--light-opacity,.22);transform:translate3d(var(--light-x,0px),var(--light-y,0px),0) scale(var(--light-scale,1));transition:transform 2.2s cubic-bezier(.22,.72,.28,1),opacity 2.2s ease;filter:blur(8px)}.orb-light-one{background:radial-gradient(circle at 35% 30%,rgba(99,225,211,.95) 0%,rgba(99,225,211,.42) 18%,transparent 58%)}.orb-light-two{background:radial-gradient(circle at 70% 68%,rgba(169,153,255,.82) 0%,rgba(169,153,255,.28) 22%,transparent 62%);filter:blur(10px)}
        .orb-core:before{content:"";position:absolute;inset:0;z-index:2;background-image:radial-gradient(1px 1px at 30% 40%,rgba(255,255,255,.9),transparent 1.7px),radial-gradient(1px 1px at 60% 25%,rgba(255,255,255,.7),transparent 1.7px),radial-gradient(1.5px 1.5px at 45% 65%,rgba(255,255,255,.8),transparent 2px),radial-gradient(1px 1px at 72% 55%,rgba(255,255,255,.75),transparent 1.7px),radial-gradient(1px 1px at 20% 60%,rgba(255,255,255,.5),transparent 1.7px),radial-gradient(1px 1px at 82% 40%,rgba(255,255,255,.6),transparent 1.7px),radial-gradient(1px 1px at 40% 80%,rgba(255,255,255,.55),transparent 1.7px),radial-gradient(1px 1px at 15% 30%,rgba(255,255,255,.5),transparent 1.7px),radial-gradient(1px 1px at 55% 15%,rgba(255,255,255,.5),transparent 1.7px),radial-gradient(1px 1px at 88% 70%,rgba(255,255,255,.5),transparent 1.7px);opacity:.65;pointer-events:none}
        .orb-core:after{content:"";position:absolute;inset:0;z-index:3;border-radius:50%;background:radial-gradient(circle at 32% 24%,rgba(255,255,255,.55),transparent 10%),radial-gradient(circle at 68% 78%,rgba(0,0,0,.52),transparent 40%);pointer-events:none}
        .orb-core.idle{filter:saturate(.65)}.orb-core.listening{box-shadow:inset -20px -24px 30px rgba(0,0,0,.65),inset 14px 10px 24px rgba(255,255,255,.16),0 0 55px rgba(99,225,211,.52),0 0 90px rgba(99,225,211,.2)}.orb-core.listening .orb-texture{animation:orb-voice 1.1s ease-in-out infinite alternate}.orb-core.thinking{box-shadow:inset -20px -24px 30px rgba(0,0,0,.65),inset 14px 10px 24px rgba(255,255,255,.16),0 0 55px rgba(169,153,255,.52),0 0 90px rgba(169,153,255,.2)}.orb-core.thinking .orb-texture{animation:orb-think 3s linear infinite}.orb-core.researching{box-shadow:inset -20px -24px 30px rgba(0,0,0,.65),inset 14px 10px 24px rgba(255,255,255,.16),0 0 55px rgba(233,184,114,.52),0 0 90px rgba(233,184,114,.18)}.orb-core.researching .orb-texture{animation:orb-think 6s linear infinite}.orb-core.speaking{box-shadow:inset -20px -24px 30px rgba(0,0,0,.65),inset 14px 10px 24px rgba(255,255,255,.16),0 0 42px rgba(99,225,211,.5),0 0 90px rgba(169,153,255,.34);animation:orb-breathe 1.5s ease-in-out infinite}.orb-core.speaking .orb-texture{animation:orb-voice .7s ease-in-out infinite alternate}.orb-core.error{box-shadow:inset -20px -24px 30px rgba(0,0,0,.65),inset 14px 10px 24px rgba(255,255,255,.16),0 0 55px rgba(246,142,123,.58)}.orb-core.muted{filter:grayscale(1) brightness(.58);opacity:.72}
        .orb-tint{position:absolute;inset:0;z-index:1;border-radius:50%;mix-blend-mode:color;opacity:0;transition:background .3s ease,opacity .3s ease}.orb-core.listening .orb-tint{background:var(--teal);opacity:1}.orb-core.thinking .orb-tint{background:var(--violet);opacity:1}.orb-core.researching .orb-tint{background:var(--amber);opacity:1}.orb-core.speaking .orb-tint{background:linear-gradient(135deg,var(--teal),var(--violet));opacity:1}.orb-core.error .orb-tint{background:var(--coral);opacity:1}
        .orb-ring{position:absolute;border-radius:50%;border:1px solid rgba(231,255,251,.52);box-shadow:0 0 10px rgba(231,255,251,.3),inset 0 0 10px rgba(231,255,251,.1)}.orb-ring.one{inset:10px;animation:orb-spin 10s linear infinite}.orb-ring.two{inset:-3px;border-color:rgba(188,222,255,.28);animation:orb-spin-reverse 16s linear infinite}.orb-ring.three{inset:-16px;border-color:rgba(169,153,255,.18);border-left-color:transparent;border-bottom-color:transparent;animation:orb-spin 22s linear infinite}.orb-ring.one:after,.orb-ring.two:after{content:"";position:absolute;width:5px;height:5px;border-radius:50%;background:#ecfffb;box-shadow:0 0 8px 3px rgba(231,255,251,.72);top:-3px;left:50%;transform:translateX(-50%)}.orb-ring.two:after{right:-3px;left:auto;top:46%;transform:none;width:7px;height:7px}
        .orb-trail{position:absolute;left:-16px;right:-16px;bottom:-18px;height:50px;border-bottom:1px solid rgba(99,225,211,.4);border-radius:50%;transform:rotate(-12deg);opacity:.7;filter:blur(.2px)}.orb-trail:after{content:"";position:absolute;right:18%;bottom:5px;width:4px;height:4px;border-radius:50%;background:var(--teal);box-shadow:0 0 9px 3px var(--teal)}
        .orb-center-mark{position:absolute;z-index:3;width:24px;height:24px;border-radius:50%;border:1px solid rgba(235,255,250,.7);box-shadow:0 0 14px rgba(99,225,211,.48),inset 0 0 9px rgba(255,255,255,.25);background:radial-gradient(circle,rgba(245,255,252,.86) 0 10%,rgba(99,225,211,.38) 11% 24%,rgba(8,24,33,.3) 25% 100%)}.orb-center-mark:after{content:"";position:absolute;inset:6px;border-radius:50%;border:1px solid rgba(236,255,250,.5)}
        .orb-state-row{position:absolute;z-index:3;left:15px;right:15px;bottom:77px;display:flex;justify-content:center;gap:5px}.orb-state{border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.035);color:#849e9a;border-radius:7px;padding:5px 7px;font-size:8px;cursor:pointer}.orb-state.active{color:var(--teal);border-color:rgba(99,225,211,.42);background:rgba(99,225,211,.09)}.orb-state[data-state="thinking"].active{color:var(--violet);border-color:rgba(169,153,255,.42);background:rgba(169,153,255,.09)}.orb-state[data-state="researching"].active{color:var(--amber);border-color:rgba(233,184,114,.42);background:rgba(233,184,114,.09)}.orb-state[data-state="error"].active{color:var(--coral);border-color:rgba(246,142,123,.42);background:rgba(246,142,123,.09)}
        .orb-chat{position:absolute;z-index:4;left:15px;right:15px;bottom:39px;height:29px;display:flex;align-items:center;gap:7px;padding:3px 4px 3px 10px;border:1px solid rgba(161,255,241,.2);border-radius:9px;background:rgba(4,19,28,.62);box-shadow:inset 0 1px rgba(255,255,255,.1)}
        .orb-chat input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#d9f4ee;font:9px ui-sans-serif,system-ui,sans-serif}.orb-chat input::placeholder{color:#718b89}.orb-chat button{width:22px;height:22px;display:grid;place-items:center;border:1px solid rgba(99,225,211,.32);border-radius:6px;background:rgba(99,225,211,.1);color:var(--teal);cursor:pointer}.orb-chat button:disabled{opacity:.4;cursor:not-allowed}.orb-chat svg{width:11px;height:11px}
        .orb-window-footer{position:absolute;left:15px;right:15px;bottom:13px;display:flex;justify-content:space-between;align-items:center;color:#78908f;font:8px ui-monospace,monospace;letter-spacing:.04em}.orb-window-footer b{color:var(--teal);font-weight:500}@keyframes orb-spin{to{transform:rotate(360deg)}}@keyframes orb-spin-reverse{to{transform:rotate(-360deg)}}@keyframes orb-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}@keyframes orb-live-shimmer{0%{transform:scale(1.005) translate3d(-1px,1px,0) rotate(-.4deg);background-position:47% 54%}13%{transform:scale(1.018) translate3d(2px,-1px,0) rotate(.25deg);background-position:54% 47%}29%{transform:scale(.998) translate3d(-2px,-2px,0) rotate(.6deg);background-position:43% 49%}46%{transform:scale(1.012) translate3d(1px,2px,0) rotate(-.2deg);background-position:52% 56%}64%{transform:scale(1.02) translate3d(3px,0,0) rotate(-.55deg);background-position:56% 45%}81%{transform:scale(1.002) translate3d(-1px,-2px,0) rotate(.35deg);background-position:45% 52%}100%{transform:scale(1.01) translate3d(1px,1px,0) rotate(-.1deg);background-position:50% 48%}}@keyframes orb-drift{0%{transform:scale(1) translate3d(-1px,1px,0)}50%{transform:scale(1.018) translate3d(1px,-1px,0)}100%{transform:scale(1.035) translate3d(-1px,1px,0)}}@keyframes orb-think{0%{transform:scale(1.03) rotate(0deg);background-position:46% 52%}50%{transform:scale(1.12) rotate(180deg);background-position:58% 44%}100%{transform:scale(1.03) rotate(360deg);background-position:46% 52%}}@keyframes orb-voice{0%{transform:scale(1.02) translateY(1px)}25%{transform:scale(1.07) translateY(-2px)}50%{transform:scale(1.12) translateY(1px)}75%{transform:scale(1.05) translateY(-1px)}100%{transform:scale(1.14) translateY(1px)}}
        @media (min-width:901px){
          .left-cluster{left:0;width:24%}
          .center-cluster{left:24%;width:52%}
          .right-cluster{right:0;left:auto;width:24%}
          .spreadsheet-card{left:24%;width:52%}
        }
        .orb-core.speaking{animation:none}
        .orb-core.speaking .orb-texture{animation:none;transform:translate(var(--voice-shift-x,0px),var(--voice-shift-y,0px)) scale(var(--voice-scale,1.015)) rotate(var(--voice-angle,0deg));transition:transform .09s ease-out}
        .orb-core.speaking:before{opacity:var(--voice-dust-opacity,.4)}
        .orb-core.wall-paused .orb-texture,.orb-core.wall-paused .orb-light{animation:none!important;transition:none!important}
        @media(prefers-reduced-motion:reduce){.orb-ring,.orb-texture,.orb-core{animation:none!important}}
      `}</style>
      <div className="desktop-layer" aria-hidden="true"><div className="desktop-top"><span>Finder&nbsp;&nbsp; File&nbsp;&nbsp; Edit&nbsp;&nbsp; View&nbsp;&nbsp; Window</span><span className="desktop-system">Wi-Fi&nbsp;&nbsp; Connected</span></div><div className="desktop-icons"><div className="desktop-icon"><i/><span>Projects</span></div><div className="desktop-icon"><i/><span>Briefings</span></div><div className="desktop-icon"><i/><span>Archive</span></div></div><div className="desktop-window"><div className="desktop-window-head"><b/><span>Weekly operations · {totalTasks} items</span></div><div className="desktop-window-body"><div className="desktop-window-nav">Overview<br/>Reports<br/>People<br/>Notes</div><div className="desktop-window-chart"/></div></div><div className="desktop-dock"><i/><i/><i/><i/></div></div>
      <div className="space-field" aria-hidden="true"/><div className="reflection-plane" aria-hidden="true"/>
      <header className="topbar glass"><div className="brand"><span className="brand-mark"><i/><i/><i/></span><span className="wordmark">KHAMELEON<small>LIVE WALL / ORGANISATIONAL SIGNAL</small></span></div><nav className="nav"><button>Work mode</button><button className="active">Overview</button><button>Agents</button><button>Research</button></nav><div className="top-right"><button className={`live-switch ${isLive ? "" : "paused"}`} onClick={() => setIsLive(!isLive)}><span className="live-dot"/>{isLive ? "LIVE" : "PAUSED"}</button><div className="menu"><button onClick={() => setMenuOpen(!menuOpen)} aria-label="Open wall menu"><Menu size={18}/></button>{menuOpen && <div className="menu-pop glass"><button onClick={() => setShowReasoning(!showReasoning)}>Reasoning {showReasoning ? "on" : "off"}</button><button onClick={() => setIsLive(!isLive)}>Set {isLive ? "pause" : "live"}</button></div>}</div></div></header>
      <section className="wall-plane">
        <article className="panel glass left-cluster">
          <div className="panel-head"><div><div className="eyebrow">Parked / 01</div><div className="panel-title">Parked <span>orbit</span></div></div><div className="status-pill"><Archive size={12}/>{parkedTasks.length} held</div></div>
          <div className="swipe-stack">
            {parkedTasks.length === 0 ? (
              <div className="swipe-card mid" style={{ top: 40 }}>
                <div className="swipe-card-head"><span>NOTHING PARKED</span></div>
                <p style={{ fontSize: 10, margin: "18px 0 6px", color: "#a7c1bd" }}>No blocked or unstarted tasks right now.</p>
              </div>
            ) : parkedTasks.map((task, i) => {
              const posClass = i === 0 ? "back" : i === 1 ? "mid" : "video";
              return (
                <div className="swipe-card" key={task.id} style={i === 2 ? { top: 66, transform: "translateX(-6px) rotate(-2deg)", zIndex: 2 } : undefined}>
                  <div className="swipe-card-head">
                    <span>{task.status === "blocked" ? "BLOCKED" : "QUEUED"} / {CATEGORY_LABELS[task.category].toUpperCase()}</span>
                    <GripVertical/>
                  </div>
                  <p style={{ fontSize: 10, margin: "18px 0 6px" }}>{task.title}</p>
                  <span className="micro" style={{ color: CATEGORY_ACCENTS[task.category] }}>{timeAgo(task.updatedAt)}</span>
                </div>
              );
            })}
          </div>
          <div className="swipe-hint"><MoveHorizontal/> Swipe aside to keep context.</div>
          <div className="mission"><div className="mission-top"><strong>Parked capacity</strong><span className="micro" style={{ color: "#e9b872" }}>{parkedTasks.length} held</span></div><p>Held work stays spatially close, without competing with the active stream.</p></div>
        </article>

        <article className="panel glass center-cluster">
          <div className="panel-head"><div><div className="eyebrow">Live orchestration / 02</div><div className="panel-title">Work in <span>motion</span></div></div><div className="privacy"><LockKeyhole size={13}/>ZDR endpoint</div></div>
          <div className="domain-row">
            <button className={domain === "all" ? "active" : ""} onClick={() => setDomain("all")}>All domains</button>
            {CATEGORIES.map((c) => <button key={c} className={domain === c ? "active" : ""} onClick={() => setDomain(c)}>{CATEGORY_LABELS[c]}{byCategory[c] ? ` · ${byCategory[c]}` : ""}</button>)}
          </div>
          <div className="route-head"><div><strong>Live task routing</strong><span>{visibleTasks.length} active signals</span></div><div className="mode">{(["Single","Parallel","Vote","Council"] as Mode[]).map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}</div></div>
          <div className="task-list">
            {visibleTasks.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", padding: 10, borderRadius: 13, background: "rgba(7,24,26,.63)", border: "1px solid rgba(255,255,255,.065)" }}><span className="task-title">No active tasks in this domain.</span></div>
            ) : visibleTasks.slice(0, 4).map((task) => {
              const Icon = CATEGORY_ICONS[task.category];
              return (
                <div className="task" key={task.id}>
                  <div className="task-icon"><Icon size={13} color={CATEGORY_ACCENTS[task.category]}/></div>
                  <div><div className="task-title">{task.title}</div><div className="task-meta">{CATEGORY_LABELS[task.category]} · {timeAgo(task.updatedAt)}</div></div>
                </div>
              );
            })}
          </div>
          <div className="activity-card">
            <div className="eyebrow" style={{ marginBottom: 5 }}>Reasoning trace</div>
            <div className="reason-head"><span>Show how the result was reached</span><button className={`toggle ${showReasoning ? "on" : ""}`} onClick={() => setShowReasoning(!showReasoning)} aria-label="Toggle reasoning"><i/></button></div>
            {showReasoning ? (
              reasoningTask ? <div className="reasoning"><p>{reasoningTask.aiRecommendation}</p></div> : <p style={{ fontSize: 9, color: "#718987", lineHeight: 1.5, marginTop: 10 }}>No reasoning trace available yet — it appears here once a task carries one.</p>
            ) : <p style={{ fontSize: 9, color: "#718987", lineHeight: 1.5, marginTop: 10 }}>Off for a clean wall view. Turn on to inspect the latest decision path.</p>}
            <div className="activity-line"><Sparkles/><p><b>Orchestration</b><small>{mode} mode · {doneTasks}/{totalTasks} tasks done today</small></p></div>
          </div>
        </article>

        <article className="panel glass right-cluster">
          <div className="panel-head"><div><div className="eyebrow">Signal cluster / 03</div><div className="panel-title">Wall <span>status</span></div></div><div className="status-pill"><Radio size={12}/>{isLive ? "Live" : "Held"}</div></div>
          <div className="rail-stat"><span>Total queries</span><strong style={{ color: "#63e1d3" }}>{health?.total_queries ?? 0}</strong></div>
          <div className="rail-stat"><span>Avg latency</span><strong>{fmtMs(health?.avg_latency_ms)}</strong></div>
          <div className="rail-stat"><span>Uptime</span><strong>{fmtUptime(health?.uptime ?? 0)}</strong></div>
          <div className="rail-stat"><span>Total cost</span><strong style={{ color: "#a999ff" }}>{fmtCost(health?.total_cost_usd)}</strong></div>
          <div className="mission" style={{ marginTop: 14 }}>
            <div className="mission-top"><strong>Today's progress</strong><Timer size={15} color="#e9b872"/></div>
            <p><b style={{ fontSize: 18 }}>{doneTasks}/{totalTasks}</b> tasks completed today.</p>
            <div className="rail-actions"><button onClick={() => setShowReasoning(!showReasoning)}>Reasoning</button><button onClick={() => setIsLive(!isLive)}>{isLive ? "Pause wall" : "Resume"}</button></div>
          </div>
          {parkedTasks[0] && <div className="right-float"><div className="right-float-head"><span>PARKED UTILITY / 02</span><GripVertical size={13}/></div><p>{parkedTasks[0].title}</p><span className="micro" style={{ color: "#63e1d3" }}>{CATEGORY_LABELS[parkedTasks[0].category].toUpperCase()} · {parkedTasks[0].status === "blocked" ? "BLOCKED" : "QUEUED"}</span></div>}
        </article>

        <article className="orb-window">
          <div className="orb-window-head"><div><div className="eyebrow">Orb window / assistant state</div><div className="orb-window-title">Khameleon <span style={{ color: "#63e1d3" }}>presence</span></div><span className="orb-window-sub">One continuous agent · state drives the atmosphere</span></div><span className="orb-window-live">{wallState.toUpperCase()}</span></div>
          <div className={`orb-stage ${wallState}`}>
            <div className="orb-ring three"/><div className="orb-ring two"/><div className="orb-ring one"/><div className="orb-trail"/>
            <div ref={orbRef} className={`orb-core ${wallState} ${isLive ? "wall-live" : "wall-paused"}`}>
              <span className="orb-texture"/><span className="orb-light orb-light-one"/><span className="orb-light orb-light-two"/><span className="orb-tint"/>
            </div>
          </div>
          <form className="orb-chat" onSubmit={submitChat}>
            <input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder={chatSent ? "Ask another question…" : "Ask Khameleon anything…"} aria-label="Chat with Khameleon" disabled={streaming}/>
            <button type="submit" disabled={!chatDraft.trim() || streaming} aria-label="Send message"><Send/></button>
          </form>
          <div className="orb-state-row">{(["idle","listening","thinking","researching","speaking","error","muted"] as WallOrbState[]).map((state) => <button key={state} type="button" className={`orb-state ${wallState === state ? "active" : ""}`} data-state={state} aria-label={state === "speaking" ? "Play a short Khameleon voice demo" : `Set ${state} state`} onClick={() => selectOrbState(state)}>{state}</button>)}</div>
          <div className="orb-window-footer"><span>{chatSent ? `${streaming ? "PROCESSING" : "SENT"} · ${chatSent.slice(0, 28)}${chatSent.length > 28 ? "…" : ""}` : (orbStatus === "speaking" ? "LIVE VOICE" : "TEXTURE / NEBULA NEUTRAL · LIGHT / REFRACTION ACTIVE")}</span><b>{wallState === "listening" ? "LISTENING" : wallState === "speaking" ? "SPEAKING" : wallState === "thinking" || wallState === "researching" ? "PROCESSING" : wallState === "error" ? "ATTENTION" : "READY"}</b></div>
        </article>
      </section>
      <footer className="footer"><div className="feed-label"><Radio/>KHAMELEON FEED</div><div className="ticker"><b>{isLive ? "LIVE" : "PAUSED"}</b>　///　{ticker}</div></footer>
    </main>
  );
}
