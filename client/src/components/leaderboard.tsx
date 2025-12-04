import { AgentCard } from "./agent-card";
import type { Agent, PerformanceMetrics } from "@shared/schema";

interface LeaderboardProps {
  agents: Agent[];
  metricsMap: Map<string, PerformanceMetrics>;
}

export function Leaderboard({ agents, metricsMap }: LeaderboardProps) {
  const sortedAgents = [...agents].sort((a, b) => {
    const metricsA = metricsMap.get(a.id);
    const metricsB = metricsMap.get(b.id);
    const pnlA = metricsA ? parseFloat(metricsA.netPnl) : 0;
    const pnlB = metricsB ? parseFloat(metricsB.netPnl) : 0;
    return pnlB - pnlA;
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">AI Leaderboard</h2>
        <p className="text-sm text-muted-foreground">
          Ranked by Net PnL
        </p>
      </div>

      <div 
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="container-leaderboard"
      >
        {sortedAgents.map((agent, index) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            metrics={metricsMap.get(agent.id) || null}
            rank={index + 1}
            isLeader={index === 0}
          />
        ))}
      </div>
    </section>
  );
}
