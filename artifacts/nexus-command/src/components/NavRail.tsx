import {
  LayoutDashboard, MessageSquare, Inbox, FolderKanban, CheckSquare, Calendar,
  FlaskConical, BrainCircuit, Network, LineChart,
  Workflow, Bot, Store, ShieldAlert, Key, Radio, ShoppingBag,
  Settings, ChevronLeft, ChevronRight, Puzzle,
} from 'lucide-react';
import { useJarvisStore, type ModuleId } from '@/store/jarvisStore';

interface NavItem {
  id: ModuleId;
  label: string;
  Icon: React.FC<{ style?: React.CSSProperties }>;
}

const CORE: NavItem[] = [
  { id: 'dashboard',  label: 'Dashboard',  Icon: LayoutDashboard },
  { id: 'chat',       label: 'Chat',        Icon: MessageSquare },
  { id: 'inbox',      label: 'Inbox',       Icon: Inbox },
  { id: 'projects',   label: 'Projects',    Icon: FolderKanban },
  { id: 'approvals',  label: 'Approvals',   Icon: CheckSquare },
  { id: 'calendar',   label: 'Calendar',    Icon: Calendar },
];

const INTEL: NavItem[] = [
  { id: 'research',     label: 'Research',    Icon: FlaskConical },
  { id: 'memory',       label: 'Memory',      Icon: BrainCircuit },
  { id: 'knowledge',    label: 'Knowledge',   Icon: Network },
  { id: 'analytics',   label: 'Analytics',   Icon: LineChart },
];

const SYSTEM: NavItem[] = [
  { id: 'automations',  label: 'Automations', Icon: Workflow },
  { id: 'agents',       label: 'Agents',      Icon: Bot },
  { id: 'skills',       label: 'Skills',      Icon: Puzzle },
  { id: 'security',     label: 'Security',    Icon: ShieldAlert },
  { id: 'vault',        label: 'Vault',       Icon: Key },
  { id: 'communications', label: 'Comms',     Icon: Radio },
  { id: 'marketplace',  label: 'Marketplace', Icon: ShoppingBag },
];

function Divider() {
  return <div style={{ height: 1, background: '#30363d', margin: '4px 8px' }} />;
}

function NavGroup({ items, expanded }: { items: NavItem[]; expanded: boolean }) {
  const { activeModule, setActiveModule } = useJarvisStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map(({ id, label, Icon }) => {
        const active = activeModule === id;
        return (
          <button
            key={id}
            onClick={() => setActiveModule(id)}
            title={!expanded ? label : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 34,
              padding: expanded ? '0 12px' : '0',
              justifyContent: expanded ? 'flex-start' : 'center',
              background: active ? '#21262d' : 'transparent',
              border: 'none',
              borderLeft: active ? '2px solid #58a6ff' : '2px solid transparent',
              borderRadius: '0 4px 4px 0',
              color: active ? '#58a6ff' : '#8b949e',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'var(--font-ui)',
              width: '100%',
              textAlign: 'left',
              transition: 'background 0.1s, color 0.1s',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
            onMouseEnter={e => {
              if (!active) e.currentTarget.style.background = '#21262d';
            }}
            onMouseLeave={e => {
              if (!active) e.currentTarget.style.background = 'transparent';
            }}
          >
            <Icon style={{
              width: 16, height: 16,
              color: active ? '#58a6ff' : '#8b949e',
              flexShrink: 0,
            }} />
            {expanded && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function NavRail() {
  const { railExpanded, setRailExpanded, setActiveModule } = useJarvisStore();
  const w = railExpanded ? 200 : 52;

  return (
    <div
      className="j-nav-rail"
      style={{
        width: w,
        flexShrink: 0,
        background: '#0d1117',
        borderRight: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        transition: 'width 0.2s ease',
      }}
    >
      {/* Scrollable nav list */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }} className="scrollbar-thin">
        <NavGroup items={CORE} expanded={railExpanded} />
        <Divider />
        <NavGroup items={INTEL} expanded={railExpanded} />
        <Divider />
        <NavGroup items={SYSTEM} expanded={railExpanded} />
      </div>

      {/* Bottom — settings + toggle */}
      <div style={{ borderTop: '1px solid #30363d', padding: '4px 0' }}>
        <button
          onClick={() => setActiveModule('settings')}
          title={!railExpanded ? 'Settings' : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            height: 34,
            padding: railExpanded ? '0 12px' : '0',
            justifyContent: railExpanded ? 'flex-start' : 'center',
            background: 'transparent', border: 'none',
            borderLeft: '2px solid transparent',
            color: '#8b949e', cursor: 'pointer', fontSize: 13,
            width: '100%', textAlign: 'left',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#21262d'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Settings style={{ width: 16, height: 16, flexShrink: 0 }} />
          {railExpanded && <span>Settings</span>}
        </button>

        {/* Expand/collapse toggle */}
        <button
          onClick={() => setRailExpanded(!railExpanded)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            height: 34,
            padding: railExpanded ? '0 12px' : '0',
            justifyContent: railExpanded ? 'flex-start' : 'center',
            background: 'transparent', border: 'none',
            color: '#484f58', cursor: 'pointer', fontSize: 12,
            width: '100%',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#8b949e'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#484f58'; }}
        >
          {railExpanded
            ? <><ChevronLeft style={{ width: 14, height: 14 }} /><span style={{ fontSize: 11 }}>Collapse</span></>
            : <ChevronRight style={{ width: 14, height: 14 }} />
          }
        </button>
      </div>
    </div>
  );
}
