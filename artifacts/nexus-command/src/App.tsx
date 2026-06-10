import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/dashboard";
import Agents from "@/pages/agents";
import Inbox from "@/pages/inbox";
import Projects from "@/pages/projects/index";
import ProjectDetail from "@/pages/projects/detail";
import Calendar from "@/pages/calendar";
import Communications from "@/pages/communications";
import Automations from "@/pages/automations";
import Security from "@/pages/security";
import Vault from "@/pages/vault";
import Research from "@/pages/research";
import Memory from "@/pages/memory";
import KnowledgeGraph from "@/pages/knowledge-graph";
import Analytics from "@/pages/analytics";
import Approvals from "@/pages/approvals";
import Marketplace from "@/pages/marketplace";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/agents" component={Agents} />
        <Route path="/inbox" component={Inbox} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/calendar" component={Calendar} />
        <Route path="/communications" component={Communications} />
        <Route path="/automations" component={Automations} />
        <Route path="/security" component={Security} />
        <Route path="/vault" component={Vault} />
        <Route path="/research" component={Research} />
        <Route path="/memory" component={Memory} />
        <Route path="/knowledge-graph" component={KnowledgeGraph} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/approvals" component={Approvals} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
