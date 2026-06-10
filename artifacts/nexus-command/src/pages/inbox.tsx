import { useState } from 'react';
import { motion } from 'framer-motion';
import { useListInboxItems, getListInboxItemsQueryKey, useUpdateInboxItem } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Inbox as InboxIcon, Check, Archive, AlertCircle, MessageCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

export default function Inbox() {
  const [filter, setFilter] = useState('All');
  const { data: items, isLoading } = useListInboxItems({ query: { queryKey: getListInboxItemsQueryKey() } });
  const updateItem = useUpdateInboxItem();
  const queryClient = useQueryClient();

  const handleUpdate = (id: number, updates: any) => {
    updateItem.mutate({ id, data: updates }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getListInboxItemsQueryKey(), (old: any) => {
          if (!old) return old;
          return old.map((i: any) => i.id === id ? { ...i, ...data } : i);
        });
      }
    });
  };

  const filteredItems = items?.filter(item => {
    if (item.isArchived) return filter === 'Archive';
    if (filter === 'All') return true;
    return item.classification === filter;
  });

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10 h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <InboxIcon className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Unified Inbox</h1>
        </div>
        
        <div className="flex bg-secondary p-1 rounded-lg border border-border">
          {['All', 'Task', 'Urgent', 'Decision', 'Archive'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                filter === f ? "bg-card text-primary shadow border border-primary/20" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide flex flex-col gap-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="glass-panel border-white/5 h-24 animate-pulse bg-secondary/30" />
          ))
        ) : filteredItems?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border border-dashed border-border rounded-xl">
            <Check className="w-12 h-12 mb-4 text-primary/40" />
            <p className="text-lg">Inbox Zero</p>
          </div>
        ) : (
          filteredItems?.map((item, i) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={cn(
                "glass-panel border-white/5 hover:border-primary/30 transition-colors group",
                item.isRead ? "opacity-70" : "border-l-4 border-l-primary"
              )}>
                <CardContent className="p-4 flex gap-4">
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {item.source === 'Email' ? <MessageCircle className="w-4 h-4 text-muted-foreground" /> : <AlertCircle className="w-4 h-4 text-accent" />}
                      <span className="text-sm font-medium text-foreground">{item.sender}</span>
                      <span className="text-xs text-muted-foreground">• {new Date(item.createdAt).toLocaleDateString()}</span>
                      <span className={cn(
                        "ml-auto text-xs px-2 py-0.5 rounded-full border font-mono",
                        item.priority === 'High' ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-secondary text-muted-foreground border-border"
                      )}>{item.priority}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
                        {item.classification}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">{item.subject}</h3>
                    
                    <div className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg border border-border mt-1">
                      <span className="font-bold text-accent mr-2">AI SUMMARY:</span>
                      {item.summary}
                    </div>
                    
                    {item.aiRecommendation && (
                      <div className="text-xs text-primary font-mono mt-1">
                        RECOMMENDATION: {item.aiRecommendation}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {!item.isRead && (
                      <Button variant="ghost" size="icon" onClick={() => handleUpdate(item.id, { isRead: true })} className="hover:text-primary hover:bg-primary/10">
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                    {!item.isArchived && (
                      <Button variant="ghost" size="icon" onClick={() => handleUpdate(item.id, { isArchived: true })} className="hover:text-destructive hover:bg-destructive/10">
                        <Archive className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
