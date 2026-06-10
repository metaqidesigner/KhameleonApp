import { useState } from 'react';
import { motion } from 'framer-motion';
import { useListResearchItems, getListResearchItemsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FlaskConical, Search, BookOpen, ExternalLink, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Research() {
  const [search, setSearch] = useState('');
  const { data: items, isLoading } = useListResearchItems({ query: { queryKey: getListResearchItemsQueryKey() } });

  const filteredItems = items?.filter(item => 
    item.title.toLowerCase().includes(search.toLowerCase()) || 
    item.description?.toLowerCase().includes(search.toLowerCase()) ||
    item.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <FlaskConical className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Research Centre</h1>
      </div>

      <div className="relative group w-full">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search research topics, entities, or tags..." 
          className="pl-10 h-12 bg-card/50 border-primary/20 focus-visible:ring-primary/50 text-base"
        />
      </div>

      <div className="flex flex-col gap-4 mt-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="glass-panel border-white/5 h-32 animate-pulse bg-secondary/30" />
          ))
        ) : filteredItems?.length === 0 ? (
          <div className="text-center p-10 border border-dashed border-border rounded-xl text-muted-foreground">
            No research items found matching your query.
          </div>
        ) : (
          filteredItems?.map((item, i) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass-panel border-white/5 hover:border-primary/30 transition-colors group">
                <CardContent className="p-5 flex gap-5">
                  <div className="hidden sm:flex w-12 h-12 rounded-lg bg-secondary/50 border border-border items-center justify-center shrink-0 group-hover:border-primary/50 group-hover:text-primary transition-colors text-muted-foreground">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">{item.title}</h3>
                      <div className="flex gap-2">
                        <span className="text-xs font-mono px-2 py-0.5 rounded border border-border bg-secondary text-muted-foreground">{item.type}</span>
                        {item.credibilityScore && (
                          <span className={cn(
                            "text-xs font-mono px-2 py-0.5 rounded border",
                            item.credibilityScore >= 90 ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-primary/10 text-primary border-primary/20"
                          )}>
                            Score: {item.credibilityScore}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    
                    {item.aiSummary && (
                      <div className="bg-primary/5 border border-primary/10 p-3 rounded-lg mt-2 text-sm text-foreground/80 flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        <div><span className="font-semibold text-primary">Key Finding:</span> {item.aiSummary}</div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex gap-2">
                        {item.tags?.map(tag => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-secondary/50 text-muted-foreground border border-border uppercase tracking-wider">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary cursor-pointer transition-colors">
                        <ExternalLink className="w-3 h-3" /> {item.sources || 0} Sources
                      </div>
                    </div>
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
