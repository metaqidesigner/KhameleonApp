import { motion } from 'framer-motion';
import { useListApprovals, getListApprovalsQueryKey, useApproveRequest, useRejectRequest } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckSquare, AlertTriangle, ShieldCheck, X, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Approvals() {
  const { data: approvals, isLoading } = useListApprovals({ query: { queryKey: getListApprovalsQueryKey() } });
  const approveReq = useApproveRequest();
  const rejectReq = useRejectRequest();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAction = (id: number, action: 'approve' | 'reject') => {
    const mutation = action === 'approve' ? approveReq : rejectReq;
    mutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.setQueryData(getListApprovalsQueryKey(), (old: any) => {
            if (!old) return old;
            return old.map((a: any) => a.id === id ? { ...a, status: action === 'approve' ? 'Approved' : 'Rejected' } : a);
          });
          toast({
            title: action === 'approve' ? "Approval Granted" : "Request Rejected",
            description: "The agent workflow has been updated.",
            variant: action === 'reject' ? "destructive" : "default"
          });
        }
      }
    );
  };

  const pending = approvals?.filter(a => a.status === 'Pending') || [];
  const history = approvals?.filter(a => a.status !== 'Pending') || [];

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <CheckSquare className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Approval Centre</h1>
      </div>

      <div className="mb-4 bg-accent/10 border border-accent/20 rounded-lg p-4 flex gap-3 text-accent">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <div>
          <h3 className="font-semibold">Pending Authorization</h3>
          <p className="text-sm opacity-90">Agents require your explicit authorization to proceed with high-risk or destructive actions.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">Pending Requests</h2>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="glass-panel border-white/5 h-32 animate-pulse bg-secondary/30" />
          ))
        ) : pending.length === 0 ? (
          <div className="text-center p-8 border border-dashed border-border rounded-xl text-muted-foreground flex flex-col items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary/40" />
            <span>No pending approvals required.</span>
          </div>
        ) : (
          pending.map((item, i) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="glass-panel border-white/10 relative overflow-hidden group hover:border-primary/40 transition-colors">
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-1",
                  item.riskLevel === 'Critical' ? "bg-destructive" : item.riskLevel === 'High' ? "bg-orange-500" : "bg-primary"
                )} />
                <CardContent className="p-5 flex flex-col md:flex-row gap-6 items-start md:items-center">
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
                        REQ-AGENT: {item.requestingAgent}
                      </span>
                      <span className={cn(
                        "text-xs font-mono px-2 py-0.5 rounded border uppercase",
                        item.riskLevel === 'Critical' ? "bg-destructive/20 border-destructive/50 text-destructive" :
                        item.riskLevel === 'High' ? "bg-orange-500/20 border-orange-500/50 text-orange-400" :
                        "bg-primary/10 border-primary/20 text-primary"
                      )}>
                        {item.riskLevel} RISK
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-foreground">{item.action}</h3>
                    <p className="text-sm text-foreground/80">{item.reason}</p>
                    
                    {item.dataInvolved && (
                      <div className="mt-1 text-xs text-muted-foreground font-mono bg-secondary/50 p-2 rounded border border-border">
                        <span className="text-foreground">TARGET DATA:</span> {item.dataInvolved}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-3 w-full md:w-auto">
                    <Button 
                      variant="outline" 
                      className="flex-1 md:flex-none border-destructive/50 hover:bg-destructive/20 hover:text-destructive text-muted-foreground"
                      onClick={() => handleAction(item.id, 'reject')}
                      disabled={rejectReq.isPending || approveReq.isPending}
                    >
                      <X className="w-4 h-4 mr-2" /> REJECT
                    </Button>
                    <Button 
                      className="flex-1 md:flex-none bg-primary hover:bg-primary/80 text-primary-foreground font-bold tracking-wider"
                      onClick={() => handleAction(item.id, 'approve')}
                      disabled={approveReq.isPending || rejectReq.isPending}
                    >
                      <Check className="w-4 h-4 mr-2" /> APPROVE
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-4 mt-8 opacity-70">
        <h2 className="text-lg font-semibold text-muted-foreground border-b border-white/5 pb-2">Audit History</h2>
        <div className="flex flex-col gap-2">
          {history.slice(0, 5).map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-secondary/10">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  item.status === 'Approved' ? "bg-green-500" : "bg-destructive"
                )} />
                <span className="text-sm font-medium text-foreground">{item.action}</span>
                <span className="text-xs text-muted-foreground">by {item.requestingAgent}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className={cn(
                  "text-xs font-mono",
                  item.status === 'Approved' ? "text-green-500" : "text-destructive"
                )}>{item.status}</span>
                <span className="text-xs text-muted-foreground font-mono">{new Date(item.resolvedAt || item.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
