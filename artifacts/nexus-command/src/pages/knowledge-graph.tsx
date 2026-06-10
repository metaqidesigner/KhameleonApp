import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Network, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useEffect, useRef } from 'react';

// Demo static data for the knowledge graph
const nodes = [
  { id: 'n1', label: 'Nexus Command', group: 'Project', x: 400, y: 300, color: 'hsl(var(--primary))' },
  { id: 'n2', label: 'Q3 Earnings', group: 'File', x: 250, y: 200, color: 'hsl(var(--chart-3))' },
  { id: 'n3', label: 'Sarah Connor', group: 'Person', x: 550, y: 150, color: 'hsl(var(--chart-2))' },
  { id: 'n4', label: 'Strategy Review', group: 'Meeting', x: 600, y: 350, color: 'hsl(var(--chart-4))' },
  { id: 'n5', label: 'Marketing Update', group: 'Email', x: 200, y: 400, color: 'hsl(var(--chart-5))' },
  { id: 'n6', label: 'Data Agent', group: 'Agent', x: 350, y: 100, color: 'hsl(var(--primary))' },
  { id: 'n7', label: 'Draft Proposal', group: 'Task', x: 650, y: 250, color: 'hsl(var(--muted-foreground))' },
];

const links = [
  { source: 'n1', target: 'n3' },
  { source: 'n1', target: 'n4' },
  { source: 'n1', target: 'n5' },
  { source: 'n3', target: 'n2' },
  { source: 'n4', target: 'n7' },
  { source: 'n6', target: 'n2' },
  { source: 'n5', target: 'n2' },
];

export default function KnowledgeGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw links
      ctx.lineWidth = 1.5;
      links.forEach(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          
          const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
          gradient.addColorStop(0, 'rgba(0, 212, 255, 0.4)');
          gradient.addColorStop(1, 'rgba(0, 212, 255, 0.1)');
          ctx.strokeStyle = gradient;
          ctx.stroke();
        }
      });

      // Draw nodes
      nodes.forEach(node => {
        // Outer glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, 15, 0, 2 * Math.PI);
        ctx.fillStyle = node.color.replace(')', ' / 0.2)').replace('hsl', 'hsl');
        ctx.fill();

        // Inner circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        ctx.font = "12px Inter, sans-serif";
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "center";
        ctx.fillText(node.label, node.x, node.y + 25);
        
        ctx.font = "10px monospace";
        ctx.fillStyle = "#64748b";
        ctx.fillText(node.group, node.x, node.y + 38);
      });
    };

    draw();

    // Simple animation effect
    let frameId: number;
    let time = 0;
    
    const animate = () => {
      time += 0.01;
      
      nodes.forEach((node, i) => {
        if (node.id !== 'n1') { // Keep center stable
          node.y += Math.sin(time + i) * 0.5;
          node.x += Math.cos(time + i) * 0.3;
        }
      });
      
      draw();
      frameId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Network className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Knowledge Graph</h1>
        </div>
        
        <div className="flex gap-2">
          <div className="p-2 bg-secondary rounded border border-border hover:bg-secondary/80 cursor-pointer"><ZoomIn className="w-4 h-4" /></div>
          <div className="p-2 bg-secondary rounded border border-border hover:bg-secondary/80 cursor-pointer"><ZoomOut className="w-4 h-4" /></div>
          <div className="p-2 bg-secondary rounded border border-border hover:bg-secondary/80 cursor-pointer"><Maximize className="w-4 h-4" /></div>
        </div>
      </div>

      <Card className="glass-panel border-white/5 flex-1 relative overflow-hidden min-h-[600px] border-primary/20 shadow-[0_0_30px_rgba(0,212,255,0.05)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,212,255,0.05),transparent_50%)]" />
        <CardContent className="p-0 h-full relative">
          <canvas 
            ref={canvasRef} 
            width={800} 
            height={600} 
            className="w-full h-full object-contain cursor-crosshair"
          />
          
          <div className="absolute top-4 left-4 flex flex-col gap-2 bg-card/80 backdrop-blur-md p-3 rounded-lg border border-white/10">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Legend</div>
            <div className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full bg-primary" /> Project/Agent</div>
            <div className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full bg-[hsl(var(--chart-3))]" /> File</div>
            <div className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full bg-[hsl(var(--chart-2))]" /> Person</div>
            <div className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full bg-[hsl(var(--chart-4))]" /> Meeting</div>
            <div className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full bg-[hsl(var(--chart-5))]" /> Email</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
