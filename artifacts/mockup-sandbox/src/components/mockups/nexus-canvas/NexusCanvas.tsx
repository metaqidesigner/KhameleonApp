import { useEffect, useRef, useState, useCallback } from "react";

const MODULES = [
  { id: "dashboard",     label: "Dashboard",     icon: "⊞", color: "#00d4ff", angle: 0 },
  { id: "agents",        label: "Agents",        icon: "◈", color: "#00d4ff", angle: 24 },
  { id: "inbox",         label: "Inbox",         icon: "⊠", color: "#00d4ff", angle: 48 },
  { id: "projects",      label: "Projects",      icon: "◧", color: "#c9a84c", angle: 72 },
  { id: "calendar",      label: "Calendar",      icon: "⊡", color: "#c9a84c", angle: 96 },
  { id: "comms",         label: "Comms",         icon: "◉", color: "#00d4ff", angle: 120 },
  { id: "automations",   label: "Automations",   icon: "⟳", color: "#a855f7", angle: 144 },
  { id: "security",      label: "Security",      icon: "⊛", color: "#ef4444", angle: 168 },
  { id: "vault",         label: "Vault",         icon: "⊟", color: "#c9a84c", angle: 192 },
  { id: "research",      label: "Research",      icon: "◎", color: "#00d4ff", angle: 216 },
  { id: "memory",        label: "Memory",        icon: "⊕", color: "#a855f7", angle: 240 },
  { id: "knowledge",     label: "Knowledge",     icon: "◬", color: "#00d4ff", angle: 264 },
  { id: "analytics",     label: "Analytics",     icon: "◈", color: "#10b981", angle: 288 },
  { id: "approvals",     label: "Approvals",     icon: "⊘", color: "#f59e0b", angle: 312 },
  { id: "marketplace",   label: "Marketplace",   icon: "◈", color: "#10b981", angle: 336 },
];

const PANEL_CONTENT: Record<string, { title: string; items: { label: string; value: string; color?: string }[] }> = {
  dashboard:   { title: "Dashboard", items: [{ label: "Active Agents", value: "10", color: "#00d4ff" }, { label: "Pending Approvals", value: "6", color: "#f59e0b" }, { label: "Projects", value: "5", color: "#10b981" }, { label: "Security Score", value: "95/100", color: "#00d4ff" }] },
  agents:      { title: "AI Agents", items: [{ label: "Email Agent", value: "Active", color: "#10b981" }, { label: "Research Agent", value: "Active", color: "#10b981" }, { label: "Security Agent", value: "Active", color: "#10b981" }, { label: "Finance Agent", value: "Active", color: "#10b981" }] },
  inbox:       { title: "Inbox", items: [{ label: "Critical", value: "2", color: "#ef4444" }, { label: "High Priority", value: "3", color: "#f59e0b" }, { label: "Unread", value: "6", color: "#00d4ff" }, { label: "AI Processed", value: "7", color: "#10b981" }] },
  projects:    { title: "Projects", items: [{ label: "AITradingMarket", value: "72%", color: "#00d4ff" }, { label: "Chameleon", value: "45%", color: "#f59e0b" }, { label: "Prop Governance", value: "88%", color: "#10b981" }, { label: "Economic Sim", value: "31%", color: "#a855f7" }] },
  calendar:    { title: "Calendar", items: [{ label: "Today", value: "2 meetings", color: "#00d4ff" }, { label: "Next", value: "Sprint Review 9am", color: "#00d4ff" }, { label: "AI Prep", value: "Ready", color: "#10b981" }, { label: "This Week", value: "6 events", color: "#c9a84c" }] },
  comms:       { title: "Communications", items: [{ label: "Urgent", value: "1", color: "#ef4444" }, { label: "Pending Reply", value: "3", color: "#f59e0b" }, { label: "AI Drafted", value: "2", color: "#10b981" }, { label: "Total", value: "6", color: "#00d4ff" }] },
  automations: { title: "Automations", items: [{ label: "Active", value: "7", color: "#10b981" }, { label: "Paused", value: "1", color: "#f59e0b" }, { label: "Time Saved", value: "42h/mo", color: "#a855f7" }, { label: "Runs Today", value: "12", color: "#00d4ff" }] },
  security:    { title: "Security", items: [{ label: "Threat Level", value: "LOW", color: "#10b981" }, { label: "Score", value: "95/100", color: "#00d4ff" }, { label: "Active Alerts", value: "1", color: "#f59e0b" }, { label: "Last Scan", value: "2h ago", color: "#10b981" }] },
  vault:       { title: "Vault", items: [{ label: "Credentials", value: "9", color: "#c9a84c" }, { label: "API Keys", value: "3", color: "#00d4ff" }, { label: "Certificates", value: "2", color: "#10b981" }, { label: "Last Rotation", value: "2 days ago", color: "#10b981" }] },
  research:    { title: "Research", items: [{ label: "Active", value: "4", color: "#00d4ff" }, { label: "Completed", value: "1", color: "#10b981" }, { label: "Sources", value: "183", color: "#a855f7" }, { label: "Avg Credibility", value: "92%", color: "#10b981" }] },
  memory:      { title: "Memory", items: [{ label: "Stored Items", value: "10", color: "#a855f7" }, { label: "Protected", value: "5", color: "#c9a84c" }, { label: "Categories", value: "4", color: "#00d4ff" }, { label: "Last Updated", value: "Today", color: "#10b981" }] },
  knowledge:   { title: "Knowledge Graph", items: [{ label: "Entities", value: "247", color: "#00d4ff" }, { label: "Connections", value: "1,432", color: "#a855f7" }, { label: "Clusters", value: "18", color: "#10b981" }, { label: "Growth", value: "+34 today", color: "#c9a84c" }] },
  analytics:   { title: "Analytics", items: [{ label: "Tasks Done", value: "89%", color: "#10b981" }, { label: "Agents Online", value: "10/11", color: "#00d4ff" }, { label: "API Latency", value: "112ms", color: "#10b981" }, { label: "Uptime", value: "99.9%", color: "#10b981" }] },
  approvals:   { title: "Approvals", items: [{ label: "Pending", value: "6", color: "#f59e0b" }, { label: "High Risk", value: "2", color: "#ef4444" }, { label: "Approved Today", value: "2", color: "#10b981" }, { label: "Oldest", value: "6h ago", color: "#f59e0b" }] },
  marketplace: { title: "Marketplace", items: [{ label: "Installed Models", value: "3", color: "#10b981" }, { label: "Available", value: "8", color: "#00d4ff" }, { label: "Top Model", value: "GPT-4o", color: "#c9a84c" }, { label: "Cost Saved", value: "18%", color: "#10b981" }] },
};

interface Neuron { x: number; y: number; vx: number; vy: number; radius: number; pulse: number; pulseSpeed: number; brightness: number; }
interface Connection { a: number; b: number; signal: number; signalSpeed: number; active: boolean; }

function useBrainCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>, w: number, h: number) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || w === 0 || h === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cx = w / 2, cy = h / 2;
    const brainR = Math.min(w, h) * 0.18;
    const N = 55;

    const neurons: Neuron[] = Array.from({ length: N }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * brainR * 0.92;
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        radius: 1.5 + Math.random() * 2.5,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.04,
        brightness: 0.5 + Math.random() * 0.5,
      };
    });

    const conns: Connection[] = [];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = neurons[i].x - neurons[j].x;
        const dy = neurons[i].y - neurons[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < brainR * 0.55) {
          conns.push({ a: i, b: j, signal: 0, signalSpeed: 0.004 + Math.random() * 0.012, active: false });
        }
      }
    }

    let frame = 0;
    let raf: number;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Ambient glow behind brain
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, brainR * 1.4);
      grad.addColorStop(0, "rgba(0,212,255,0.07)");
      grad.addColorStop(0.5, "rgba(0,80,150,0.04)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Activate signals randomly
      if (frame % 8 === 0) {
        const idx = Math.floor(Math.random() * conns.length);
        conns[idx].active = true;
        conns[idx].signal = 0;
      }

      // Draw connections
      for (const c of conns) {
        const na = neurons[c.a], nb = neurons[c.b];
        const dx = nb.x - na.x, dy = nb.y - na.y;

        if (c.active) {
          c.signal += c.signalSpeed;
          if (c.signal >= 1) { c.active = false; c.signal = 0; }

          const sx = na.x + dx * c.signal;
          const sy = na.y + dy * c.signal;

          // Signal dot
          const dotGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 6);
          dotGrad.addColorStop(0, "rgba(0,212,255,0.9)");
          dotGrad.addColorStop(1, "rgba(0,212,255,0)");
          ctx.fillStyle = dotGrad;
          ctx.beginPath();
          ctx.arc(sx, sy, 6, 0, Math.PI * 2);
          ctx.fill();

          // Lit connection
          ctx.beginPath();
          ctx.moveTo(na.x, na.y);
          ctx.lineTo(nb.x, nb.y);
          ctx.strokeStyle = `rgba(0,212,255,0.5)`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          const dist = Math.sqrt(dx * dx + dy * dy);
          const opacity = Math.max(0, 0.12 - dist / (brainR * 8));
          ctx.beginPath();
          ctx.moveTo(na.x, na.y);
          ctx.lineTo(nb.x, nb.y);
          ctx.strokeStyle = `rgba(0,120,200,${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      // Draw neurons
      for (const n of neurons) {
        n.pulse += n.pulseSpeed;
        const pulseMul = 0.7 + 0.3 * Math.sin(n.pulse);
        const r = n.radius * pulseMul;
        const alpha = (0.5 + 0.5 * pulseMul) * n.brightness;

        const ng = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 4);
        ng.addColorStop(0, `rgba(0,212,255,${alpha})`);
        ng.addColorStop(0.4, `rgba(0,150,220,${alpha * 0.4})`);
        ng.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,240,255,${alpha})`;
        ctx.fill();

        // Drift neurons gently
        n.x += n.vx;
        n.y += n.vy;
        const dx2 = n.x - cx, dy2 = n.y - cy;
        const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (d2 > brainR * 0.95) {
          n.vx -= dx2 / d2 * 0.05;
          n.vy -= dy2 / d2 * 0.05;
        }
        if (d2 < 10) { n.vx += (Math.random() - 0.5) * 0.1; n.vy += (Math.random() - 0.5) * 0.1; }
      }

      // Outer pulse rings
      const ringT = frame * 0.012;
      for (let ring = 0; ring < 3; ring++) {
        const t = ((ringT + ring / 3) % 1);
        const ringR = brainR * (1.05 + t * 0.6);
        const ringAlpha = (1 - t) * 0.25;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,212,255,${ringAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Static orbit ring
      ctx.beginPath();
      ctx.arc(cx, cy, brainR * 1.12, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,212,255,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();

      frame++;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, w, h]);
}

export function NexusCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setSize({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useBrainCanvas(canvasRef, size.w, size.h);

  const openModule = useCallback((id: string) => {
    setActiveModule(id);
    setPanelVisible(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelVisible(false);
    setTimeout(() => setActiveModule(null), 350);
  }, []);

  const cx = size.w / 2;
  const cy = size.h / 2;
  const orbitR = Math.min(size.w, size.h) * 0.38;

  const panel = activeModule ? PANEL_CONTENT[activeModule] : null;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100vh",
        background: "#020810",
        overflow: "hidden",
        position: "relative",
        fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
      }}
    >
      {/* Starfield background */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, #030f1a 0%, #020810 60%, #010508 100%)" }} />

      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 56,
        background: "rgba(2,8,16,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,212,255,0.12)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#00d4ff",
            boxShadow: "0 0 8px #00d4ff, 0 0 16px rgba(0,212,255,0.5)",
            animation: "pulse 2s infinite",
          }} />
          <span style={{ color: "#00d4ff", fontWeight: 700, fontSize: 15, letterSpacing: "0.18em", textTransform: "uppercase" }}>
            NEXUS COMMAND
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px", background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 20 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
            <span style={{ color: "#10b981", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em" }}>WORK MODE</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 20 }}>
            <span style={{ color: "#10b981", fontSize: 12, fontWeight: 600 }}>⚡ 99.9% HEALTH</span>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #00d4ff22, #00d4ff44)", border: "1px solid rgba(0,212,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <span style={{ color: "#00d4ff", fontWeight: 700, fontSize: 13 }}>EX</span>
          </div>
        </div>
      </div>

      {/* Brain canvas */}
      {size.w > 0 && (
        <canvas
          ref={canvasRef}
          width={size.w}
          height={size.h}
          style={{ position: "absolute", inset: 0, zIndex: 1 }}
        />
      )}

      {/* Center core label */}
      {size.w > 0 && (
        <div style={{
          position: "absolute",
          left: cx,
          top: cy,
          transform: "translate(-50%, -50%)",
          zIndex: 10,
          textAlign: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            fontSize: 11,
            letterSpacing: "0.25em",
            color: "rgba(0,212,255,0.7)",
            marginBottom: 4,
            fontWeight: 500,
          }}>NEXUS CORE</div>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "#ffffff",
            textShadow: "0 0 20px rgba(0,212,255,0.8)",
          }}>ONLINE</div>
        </div>
      )}

      {/* Module nodes */}
      {size.w > 0 && MODULES.map((mod) => {
        const rad = (mod.angle - 90) * (Math.PI / 180);
        const nx = cx + Math.cos(rad) * orbitR;
        const ny = cy + Math.sin(rad) * orbitR;
        const isHovered = hoveredModule === mod.id;
        const isActive = activeModule === mod.id;

        return (
          <div
            key={mod.id}
            style={{
              position: "absolute",
              left: nx,
              top: ny,
              transform: "translate(-50%, -50%)",
              zIndex: 20,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              transition: "transform 0.2s ease",
            }}
            onMouseEnter={() => setHoveredModule(mod.id)}
            onMouseLeave={() => setHoveredModule(null)}
            onClick={() => openModule(mod.id)}
          >
            {/* Connector line to center */}
            <svg
              style={{ position: "absolute", pointerEvents: "none", zIndex: -1, overflow: "visible" }}
              width={1} height={1}
            >
              <line
                x1={0} y1={0}
                x2={cx - nx} y2={cy - ny}
                stroke={isActive ? mod.color : `rgba(0,212,255,0.08)`}
                strokeWidth={isActive ? 1.5 : 1}
                strokeDasharray={isActive ? "none" : "4 6"}
              />
            </svg>

            {/* Node button */}
            <div style={{
              width: isHovered || isActive ? 52 : 46,
              height: isHovered || isActive ? 52 : 46,
              borderRadius: "50%",
              background: isActive
                ? `rgba(${mod.color === "#00d4ff" ? "0,212,255" : mod.color === "#c9a84c" ? "201,168,76" : mod.color === "#a855f7" ? "168,85,247" : mod.color === "#ef4444" ? "239,68,68" : mod.color === "#10b981" ? "16,185,129" : "245,158,11"},0.2)`
                : isHovered
                ? `rgba(${mod.color === "#00d4ff" ? "0,212,255" : "255,255,255"},0.08)`
                : "rgba(2,20,40,0.8)",
              border: `1.5px solid ${isActive || isHovered ? mod.color : "rgba(0,212,255,0.2)"}`,
              boxShadow: isActive
                ? `0 0 20px ${mod.color}55, 0 0 40px ${mod.color}22, inset 0 0 15px ${mod.color}15`
                : isHovered
                ? `0 0 12px ${mod.color}44`
                : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              backdropFilter: "blur(10px)",
            }}>
              <span style={{ fontSize: 18, color: isActive || isHovered ? mod.color : "rgba(0,212,255,0.6)" }}>
                {mod.icon}
              </span>
            </div>

            {/* Label */}
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: isActive || isHovered ? mod.color : "rgba(150,200,230,0.6)",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              transition: "color 0.2s",
              textShadow: isActive ? `0 0 8px ${mod.color}` : "none",
            }}>
              {mod.label}
            </div>
          </div>
        );
      })}

      {/* Slide-in panel */}
      <div style={{
        position: "absolute",
        top: 56,
        right: 0,
        bottom: 0,
        width: 380,
        transform: panelVisible ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.35s cubic-bezier(0.16,1,0.3,1)",
        background: "rgba(3,12,24,0.95)",
        backdropFilter: "blur(24px)",
        borderLeft: "1px solid rgba(0,212,255,0.15)",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
      }}>
        {panel && (
          <>
            {/* Panel header */}
            <div style={{
              padding: "24px 28px 20px",
              borderBottom: "1px solid rgba(0,212,255,0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "rgba(0,212,255,0.5)", marginBottom: 4 }}>MODULE</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>{panel.title}</div>
              </div>
              <button
                onClick={closePanel}
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)",
                  color: "rgba(0,212,255,0.7)", fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >×</button>
            </div>

            {/* Panel metrics */}
            <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
              {panel.items.map((item) => (
                <div key={item.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "16px 20px",
                  background: "rgba(0,212,255,0.04)",
                  border: "1px solid rgba(0,212,255,0.08)",
                  borderRadius: 12,
                }}>
                  <span style={{ color: "rgba(160,200,230,0.8)", fontSize: 13, fontWeight: 500 }}>{item.label}</span>
                  <span style={{ color: item.color || "#00d4ff", fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums", textShadow: `0 0 10px ${item.color || "#00d4ff"}88` }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Panel action */}
            <div style={{ padding: "0 28px", marginTop: "auto", paddingBottom: 28 }}>
              <button style={{
                width: "100%", padding: "14px",
                background: "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.06))",
                border: "1px solid rgba(0,212,255,0.3)",
                borderRadius: 12,
                color: "#00d4ff", fontWeight: 600, fontSize: 13,
                letterSpacing: "0.1em", cursor: "pointer",
                textTransform: "uppercase",
              }}>
                Open Full {panel.title} →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Overlay backdrop for panel (subtle) */}
      {panelVisible && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 35, cursor: "pointer" }}
          onClick={closePanel}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
