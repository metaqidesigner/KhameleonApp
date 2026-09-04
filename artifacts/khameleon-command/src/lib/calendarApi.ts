const BASE = import.meta.env.VITE_API_URL || '/api';

export interface CalendarEvent {
  id: string | number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  type: string;
  attendees: string[];
  location: string;
  aiPrep: string;
  relatedProject: string;
  actionItems: string[];
  createdAt: string;
}

/** Reads degrade to empty on failure - an empty calendar and an unreachable backend look the same, honestly. */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    const res = await fetch(`${BASE}/calendar/events`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
