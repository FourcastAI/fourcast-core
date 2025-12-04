import { ArrowDown, ArrowUp, Minus, Brain, Sparkles, Cpu, Atom } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Agent, PerformanceMetrics } from "@shared/schema";

interface AgentCardProps {
  agent: Agent;
  metrics: PerformanceMetrics | null;
  rank: number;
  isLeader: boolean;
}

const agentIcons: Record<string, typeof Brain> = {
  "GPT-5": Sparkles,
  "Grok": Brain,
  "Claude": Cpu,
  "Gemini": Atom,
};

const agentColors: Record<string, string> = {
  "GPT-5": "text-teal-500 bg-teal-500/10 border-teal-500/30",
  "Grok": "text-purple-500 bg-purple-500/10 border-purple-500/30",
  "Claude": "text-orange-500 bg-orange-500/10 border-orange-500/30",
  "Gemini": "text-blue-500 bg-blue-500/10 border-blue-500/30",
};

export function AgentCard({ agent, metrics, rank, isLeader }: AgentCardProps) {
  const Icon = agentIcons[agent.name] || Brain;
  const colorClass = agentColors[agent.name] || "text-muted-foreground";
  
  const pnl = metrics ? parseFloat(metrics.netPnl) : 0;
  const pnlPercent = (pnl / parseFloat(agent.initialBalance)) * 100;
  const winRate = metrics ? parseFloat(metrics.winRate) * 100 : 0;
  const balance = parseFloat(agent.currentBalance);
  
  const isPositive = pnl > 0;
  const isNeutral = pnl === 0;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200",
        isLeader && "ring-2 ring-chart-2/50 shadow-lg shadow-chart-2/10"
      )}
      data-testid={`card-agent-${agent.id}`}
    >
      {isLeader && (
        <div className="absolute right-0 top-0 overflow-hidden">
          <div className="absolute -right-8 top-3 rotate-45 bg-chart-2 px-8 py-0.5 text-xs font-semibold text-white shadow">
            LEADER
          </div>
        </div>
      )}
      
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl border", colorClass)}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{agent.name}</h3>
                <Badge variant="secondary" className="text-xs">
                  #{rank}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{agent.model}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Net PnL</span>
            <div className="flex items-center gap-1.5">
              {isPositive ? (
                <ArrowUp className="h-4 w-4 text-chart-2" />
              ) : isNeutral ? (
                <Minus className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ArrowDown className="h-4 w-4 text-destructive" />
              )}
              <span
                className={cn(
                  "font-mono text-2xl font-bold",
                  isPositive && "text-chart-2",
                  !isPositive && !isNeutral && "text-destructive"
                )}
                data-testid={`text-pnl-${agent.id}`}
              >
                {isPositive ? "+" : ""}{pnl.toFixed(2)}
              </span>
              <span className="text-sm text-muted-foreground">USDC</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Change</span>
            <span
              className={cn(
                "font-mono font-medium",
                isPositive && "text-chart-2",
                !isPositive && !isNeutral && "text-destructive"
              )}
            >
              {isPositive ? "+" : ""}{pnlPercent.toFixed(2)}%
            </span>
          </div>

          <div className="h-px bg-border" />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Balance</span>
              <p className="font-mono font-semibold">${balance.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Win Rate</span>
              <p className="font-mono font-semibold">{winRate.toFixed(1)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Trades</span>
              <p className="font-mono font-semibold">{metrics?.totalTrades || 0}</p>
            </div>
            <div>
              <span className="text-muted-foreground">W/L</span>
              <p className="font-mono font-semibold">
                <span className="text-chart-2">{metrics?.winningTrades || 0}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-destructive">{metrics?.losingTrades || 0}</span>
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
