import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { LoginGate } from "@/components/LoginGate";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LoginGate>
        <AppShell />
      </LoginGate>
    </QueryClientProvider>
  );
}
