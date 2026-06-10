import { useState } from 'react';
import { motion } from 'framer-motion';
import { useListMemoryItems, getListMemoryItemsQueryKey, useCreateMemoryItem, useDeleteMemoryItem } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BrainCircuit, Lock, Unlock, Trash2, Plus, Brain } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function Memory() {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [category, setCategory] = useState('Preferences');
  
  const { data: memories, isLoading } = useListMemoryItems({ query: { queryKey: getListMemoryItemsQueryKey() } });
  const createMemory = useCreateMemoryItem();
  const deleteMemory = useDeleteMemoryItem();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreate = () => {
    if (!newKey || !newValue) return;
    createMemory.mutate(
      { data: { key: newKey, value: newValue, category, isProtected: false } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getListMemoryItemsQueryKey(), (old: any) => {
            if (!old) return [data];
            return [...old, data];
          });
          setNewKey('');
          setNewValue('');
          toast({ title: "Memory Stored", description: "Successfully committed to Nexus Memory." });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteMemory.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.setQueryData(getListMemoryItemsQueryKey(), (old: any) => {
            if (!old) return old;
            return old.filter((m: any) => m.id !== id);
          });
          toast({ title: "Memory Erased", description: "Memory successfully deleted." });
        }
      }
    );
  };

  const groupedMemories = memories?.reduce((acc: any, curr: any) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <BrainCircuit className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Digital Memory</h1>
      </div>

      <Card className="glass-panel border-primary/20 bg-card/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-primary uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-4 h-4" /> Store New Memory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 bg-secondary border border-border text-foreground rounded-md px-3 outline-none focus:ring-1 focus:ring-primary md:w-48"
            >
              <option value="Preferences">Preferences</option>
              <option value="Contacts">Contacts</option>
              <option value="Workflows">Workflows</option>
              <option value="Business Goals">Business Goals</option>
            </select>
            <Input 
              placeholder="Key (e.g. Flight Preference)" 
              value={newKey} 
              onChange={(e) => setNewKey(e.target.value)}
              className="bg-secondary/50 border-border md:w-1/3"
            />
            <Input 
              placeholder="Value (e.g. Aisle seat, near front)" 
              value={newValue} 
              onChange={(e) => setNewValue(e.target.value)}
              className="bg-secondary/50 border-border flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={createMemory.isPending} className="bg-primary hover:bg-primary/80">
              Commit
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="glass-panel border-white/5 h-48 animate-pulse bg-secondary/30" />
          ))
        ) : (
          Object.keys(groupedMemories || {}).map((cat, i) => (
            <motion.div 
              key={cat}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="glass-panel border-white/5 h-full">
                <CardHeader className="pb-3 border-b border-white/5">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Brain className="w-5 h-5 text-muted-foreground" /> {cat}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex flex-col">
                    {groupedMemories[cat].map((memory: any, idx: number) => (
                      <div key={memory.id} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-secondary/20 transition-colors group">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{memory.key}</span>
                            {memory.isProtected && <Lock className="w-3 h-3 text-accent" />}
                          </div>
                          <div className="text-sm text-muted-foreground mt-0.5">{memory.value}</div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          {!memory.isProtected && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(memory.id)} disabled={deleteMemory.isPending} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
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
