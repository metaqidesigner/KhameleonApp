import { motion } from 'framer-motion';
import { useListMarketplaceAgents, getListMarketplaceAgentsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Store, Download, Check, Shield, Zap, TrendingUp, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Marketplace() {
  const { data: agents, isLoading } = useListMarketplaceAgents({ query: { queryKey: getListMarketplaceAgentsQueryKey() } });

  const ScoreBar = ({ label, score, icon: Icon, colorClass }: { label: string, score: number, icon: any, colorClass: string }) => (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground w-20">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="flex-1 mx-3 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", colorClass)} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono w-6 text-right text-foreground">{score}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <Store className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">AI Marketplace</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="glass-panel border-white/5 h-[340px] animate-pulse bg-secondary/30" />
          ))
        ) : (
          agents?.map((agent, i) => (
            <motion.div 
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass-panel border-white/10 hover:border-primary/40 hover:shadow-[0_0_20px_rgba(0,212,255,0.1)] transition-all h-full flex flex-col group">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs text-primary font-mono uppercase tracking-wider mb-1 flex items-center gap-1">
                        {agent.provider}
                      </div>
                      <CardTitle className="text-xl text-foreground group-hover:text-primary transition-colors">{agent.name}</CardTitle>
                    </div>
                    {agent.isInstalled && (
                      <span className="bg-primary/20 text-primary p-1 rounded-full"><Check className="w-4 h-4" /></span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-5">
                  <p className="text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
                  
                  <div className="flex flex-col gap-2 mt-auto bg-secondary/20 p-3 rounded-lg border border-white/5">
                    <ScoreBar label="Accuracy" score={agent.accuracyScore} icon={TrendingUp} colorClass="bg-green-400" />
                    <ScoreBar label="Speed" score={agent.speedScore} icon={Zap} colorClass="bg-primary" />
                    <ScoreBar label="Reliability" score={agent.reliabilityScore} icon={Shield} colorClass="bg-accent" />
                    <ScoreBar label="Privacy" score={agent.privacyScore} icon={Lock} colorClass="bg-indigo-400" />
                  </div>
                </CardContent>
                <CardFooter className="pt-0 flex justify-between items-center mt-2 border-t border-white/5 pb-4 pt-4">
                  <div className="text-xs font-mono text-muted-foreground">{agent.pricing || 'Free / Open Source'}</div>
                  <Button 
                    variant={agent.isInstalled ? "outline" : "default"}
                    className={cn(
                      "h-8 text-xs font-bold tracking-wider",
                      agent.isInstalled ? "border-white/10 text-muted-foreground hover:bg-secondary" : "bg-primary hover:bg-primary/80 text-primary-foreground"
                    )}
                  >
                    {agent.isInstalled ? 'INSTALLED' : <><Download className="w-3 h-3 mr-2" /> INSTALL</>}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
