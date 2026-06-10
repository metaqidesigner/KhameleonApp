import { motion } from 'framer-motion';
import { useListCalendarEvents, getListCalendarEventsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarIcon, Clock, Users, MapPin, Sparkles, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Calendar() {
  const { data: events, isLoading } = useListCalendarEvents({ query: { queryKey: getListCalendarEventsQueryKey() } });

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <CalendarIcon className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Calendar Command</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-primary/80 uppercase tracking-wider mb-2">Today's Agenda</h2>
          
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="glass-panel border-white/5 h-32 animate-pulse bg-secondary/30" />
            ))
          ) : events?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl">
              No meetings scheduled for today.
            </div>
          ) : (
            events?.map((event, i) => {
              const start = new Date(event.startTime);
              const end = new Date(event.endTime);
              const timeString = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
              
              return (
                <motion.div 
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className="glass-panel border-white/10 hover:border-primary/40 transition-colors relative overflow-hidden group">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/40 group-hover:bg-primary transition-colors" />
                    <CardContent className="p-5 flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{event.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {timeString}</span>
                            {event.location && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {event.location}</span>}
                          </div>
                        </div>
                        <span className="px-2 py-1 text-xs font-mono rounded bg-secondary text-muted-foreground border border-border">
                          {event.type}
                        </span>
                      </div>
                      
                      {event.attendees && event.attendees.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-foreground/80">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span>{event.attendees.join(', ')}</span>
                        </div>
                      )}

                      {(event.aiPrep || event.actionItems) && (
                        <div className="mt-2 bg-secondary/30 rounded-lg p-3 border border-primary/10">
                          {event.aiPrep && (
                            <div className="flex items-start gap-2 mb-3">
                              <Sparkles className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                              <div className="text-sm">
                                <span className="font-bold text-accent">AI BRIEFING: </span>
                                <span className="text-foreground/80">{event.aiPrep}</span>
                              </div>
                            </div>
                          )}
                          
                          {event.actionItems && event.actionItems.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-xs font-bold text-primary uppercase tracking-wider">Action Items:</span>
                              {event.actionItems.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm text-foreground/70">
                                  <CheckSquare className="w-4 h-4 text-primary/60 shrink-0" /> {item}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card className="glass-panel border-white/5">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Weekly Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground text-sm italic">Calendar integration pending. Showing current day only.</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
