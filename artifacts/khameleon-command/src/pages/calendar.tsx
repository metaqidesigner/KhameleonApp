import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import JarvisStubPage from '@/components/JarvisStubPage';

export default function Calendar() {
  return <JarvisStubPage title="CALENDAR" icon={<CalendarIcon size={13}/>} connectors={['Google Calendar','Outlook','Apple Calendar','Notion']} />;
}
