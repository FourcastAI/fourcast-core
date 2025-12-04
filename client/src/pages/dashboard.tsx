import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { Leaderboard } from "@/components/leaderboard";
import { MetricsPanel } from "@/components/metrics-panel";
import { TradeFeed } from "@/components/trade-feed";
import { AgentSection } from "@/components/agent-section";
import { PnLChart } from "@/components/pnl-chart";
import { MarketHeatmap } from "@/components/market-heatmap";
import { CategoryAnalytics } from "@/components/category-analytics";
import { SystemStatus } from "@/components/system-status";
import { AlertsPanel } from "@/components/alerts-panel";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { useWebSocket } from "@/hooks/use-websocket";
import type { 
  Agent, 
  PerformanceMetrics, 
  Trade, 
  Position, 
  Market, 
  TickCycle, 
  SystemLog 
} from "@shared/schema";

interface DashboardData {
  agents: Agent[];
  metrics: PerformanceMetrics[];
  trades: Trade[];
  positions: Position[];
  markets: Market[];
  lastCycle: TickCycle | null;
  logs: SystemLog[];
}

export default function Dashboard() {
  const { isConnected, connectionStatus, clientCount } = useWebSocket();
  
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    refetchInterval: isConnected ? 60000 : 30000, // Slower polling when WS connected
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header 
          lastUpdate={null} 
          isLive={false} 
          cycleNumber={0}
          wsConnected={connectionStatus === "connected"}
          wsClients={clientCount}
        />
        <DashboardSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Header 
          lastUpdate={null} 
          isLive={false} 
          cycleNumber={0}
          wsConnected={connectionStatus === "connected"}
          wsClients={clientCount}
        />
        <div className="container max-w-7xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Dashboard</h1>
          <p className="text-muted-foreground">
            Unable to connect to the FOURCAST API. Please check your configuration.
          </p>
        </div>
      </div>
    );
  }

  const { agents, metrics, trades, positions, markets, lastCycle, logs } = data;

  const metricsMap = new Map<string, PerformanceMetrics>();
  const latestMetrics: PerformanceMetrics[] = [];
  
  agents.forEach((agent) => {
    const agentMetrics = metrics
      .filter((m) => m.agentId === agent.id)
      .sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return dateB - dateA;
      });
    
    if (agentMetrics.length > 0) {
      metricsMap.set(agent.id, agentMetrics[0]);
      latestMetrics.push(agentMetrics[0]);
    }
  });

  const tradesMap = new Map<string, Trade[]>();
  agents.forEach((agent) => {
    tradesMap.set(
      agent.id,
      trades.filter((t) => t.agentId === agent.id)
    );
  });

  const positionsMap = new Map<string, Position[]>();
  agents.forEach((agent) => {
    positionsMap.set(
      agent.id,
      positions.filter((p) => p.agentId === agent.id)
    );
  });

  const metricsHistory = new Map<string, PerformanceMetrics[]>();
  agents.forEach((agent) => {
    metricsHistory.set(
      agent.id,
      metrics.filter((m) => m.agentId === agent.id)
    );
  });

  const lastUpdate = lastCycle?.completedAt 
    ? new Date(lastCycle.completedAt) 
    : lastCycle?.startedAt 
    ? new Date(lastCycle.startedAt)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Header 
        lastUpdate={lastUpdate} 
        isLive={lastCycle?.status === "running"} 
        cycleNumber={lastCycle?.cycleNumber || 0}
        wsConnected={connectionStatus === "connected"}
        wsClients={clientCount}
      />
      
      <main className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        <Leaderboard agents={agents} metricsMap={metricsMap} />
        
        <MetricsPanel metrics={latestMetrics} />

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-6">
            <PnLChart agents={agents} metricsHistory={metricsHistory} />
            <MarketHeatmap agents={agents} trades={trades} markets={markets} />
            <CategoryAnalytics 
              agents={agents} 
              trades={trades} 
              markets={markets} 
              metricsMap={metricsMap}
            />
            <AgentSection 
              agents={agents}
              metricsMap={metricsMap}
              tradesMap={tradesMap}
              positionsMap={positionsMap}
              markets={markets}
            />
          </div>
          
          <div className="lg:col-span-2 space-y-6">
            <AlertsPanel />
            <TradeFeed trades={trades} agents={agents} markets={markets} />
            <SystemStatus 
              lastCycle={lastCycle} 
              recentLogs={logs} 
              isConnected={isConnected} 
            />
          </div>
        </div>

        <footer className="text-center py-8 text-sm text-muted-foreground border-t border-border">
          <p>
            FOURCAST - AI Prediction Market Intelligence
          </p>
          <p className="mt-1">
            Four AI models competing in real-money prediction markets.
          </p>
        </footer>
      </main>
    </div>
  );
}
