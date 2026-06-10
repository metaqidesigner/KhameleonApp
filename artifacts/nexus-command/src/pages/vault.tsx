import { motion } from 'framer-motion';
import { useListVaultItems, getListVaultItemsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Key, Lock, AlertTriangle, Fingerprint } from 'lucide-react';

export default function Vault() {
  const { data: items, isLoading } = useListVaultItems({ query: { queryKey: getListVaultItemsQueryKey() } });

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <Key className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Nexus Vault</h1>
      </div>

      <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3 text-destructive">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold">SECURITY NOTICE</h3>
          <p className="text-sm mt-1">Mock data only — no real credentials, keys, or sensitive information are stored in this demo environment. The Vault demonstrates credential management UI patterns.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="glass-panel border-white/5 h-32 animate-pulse bg-secondary/30" />
          ))
        ) : (
          items?.map((item, i) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass-panel border-white/5 hover:border-primary/30 transition-all group overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Fingerprint className="w-24 h-24" />
                </div>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start relative z-10">
                    <CardTitle className="text-lg text-foreground font-mono">{item.name}</CardTitle>
                    <Lock className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardHeader>
                <CardContent className="relative z-10 flex flex-col gap-3">
                  <div className="flex gap-2">
                    <span className="text-xs px-2 py-0.5 rounded border border-border bg-secondary text-muted-foreground uppercase tracking-wider">
                      {item.category}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded border border-primary/20 bg-primary/10 text-primary uppercase tracking-wider">
                      {item.permissionLevel}
                    </span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground font-mono mt-2">
                    Last Access: {new Date(item.lastAccessed).toLocaleString()}
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
