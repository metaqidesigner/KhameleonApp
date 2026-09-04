import { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, MapPin, Users } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { getCalendarEvents, type CalendarEvent } from '@/lib/calendarApi';

/**
 * Real calendar backend (routes/calendar.ts) has existed since well
 * before this pass - live Google Calendar / Outlook Calendar fetch with
 * a local DB fallback - but the page itself was a 7-line JarvisStubPage
 * with a permanently-looping "CONNECTING..." animation and a CONNECT
 * button with no onClick at all. This is the real page for that
 * already-real backend.
 */
function groupByDay(events: CalendarEvent[]): [string, CalendarEvent[]][] {
  const groups = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const d = new Date(ev.startTime);
    const key = Number.isNaN(d.getTime())
      ? 'Unscheduled'
      : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const list = groups.get(key) ?? [];
    list.push(ev);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

function formatTimeRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime())) return '';
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return Number.isNaN(e.getTime()) ? fmt(s) : `${fmt(s)} – ${fmt(e)}`;
}

export default function Calendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCalendarEvents().then(evs => { setEvents(evs); setLoading(false); });
  }, []);

  const grouped = useMemo(() => groupByDay(events), [events]);

  return (
    <div style={{ height: '100%', padding: 8 }}>
      <JPanel title="CALENDAR" icon={<CalendarIcon size={13} />} badge={loading ? 'LOADING' : `${events.length} EVENTS`}>
        {loading ? (
          <div className="j-empty">LOADING…</div>
        ) : events.length === 0 ? (
          <div className="j-empty">
            NO UPCOMING EVENTS — CONNECT GOOGLE OR MICROSOFT IN INTEGRATIONS TO SEE YOUR REAL CALENDAR
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {grouped.map(([day, dayEvents]) => (
              <div key={day}>
                <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, fontWeight: 700, color: 'var(--j-cyan)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  {day}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {dayEvents.map(ev => (
                    <div key={ev.id} style={{ padding: '10px 12px', background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.1)', display: 'flex', gap: 12 }}>
                      <div style={{ width: 90, flexShrink: 0, fontFamily: 'var(--j-font-mono)', fontSize: 10, color: 'var(--j-text-muted)' }}>
                        {formatTimeRange(ev.startTime, ev.endTime)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: '#fff' }}>{ev.title}</div>
                        {ev.description && (
                          <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-text-muted)', marginTop: 3 }}>{ev.description}</div>
                        )}
                        <div style={{ display: 'flex', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
                          {ev.location && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-text-faint)' }}>
                              <MapPin size={9} /> {ev.location}
                            </span>
                          )}
                          {ev.attendees.length > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-text-faint)' }}>
                              <Users size={9} /> {ev.attendees.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </JPanel>
    </div>
  );
}
