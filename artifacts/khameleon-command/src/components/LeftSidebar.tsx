import React from 'react';
import { MessageSquare, LayoutGrid, FileText, Link2, TrendingUp, CheckSquare, Settings } from 'lucide-react';
import { useJarvisStore, type TabId } from '@/store/jarvisStore';

const NAV_ITEMS: { id: TabId; icon: React.ReactNode; title: string }[] = [
  { id: 'canvas',    icon: <LayoutGrid   size={17} />, title: 'Canvas'    },
  { id: 'tasks',     icon: <FileText     size={17} />, title: 'Tasks'     },
  { id: 'agents',    icon: <Link2        size={17} />, title: 'Agents'    },
  { id: 'analytics', icon: <TrendingUp   size={17} />, title: 'Analytics' },
  { id: 'comms',     icon: <MessageSquare size={17} />, title: 'Messages' },
  { id: 'approvals', icon: <CheckSquare  size={17} />, title: 'Approvals' },
];

export function LeftSidebar() {
  const activeTab    = useJarvisStore(s => s.activeTab);
  const setActiveTab = useJarvisStore(s => s.setActiveTab);

  return (
    <div className="j-left-sidebar">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            title={item.title}
            className={`j-sidebar-icon-btn${activeTab === item.id ? ' active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            {item.icon}
          </button>
        ))}
      </div>

      {/* Settings at bottom */}
      <button
        title="Settings"
        className={`j-sidebar-icon-btn${activeTab === 'settings' ? ' active' : ''}`}
        onClick={() => setActiveTab('settings')}
        style={{ marginBottom: 8 }}
      >
        <Settings size={17} />
      </button>
    </div>
  );
}
