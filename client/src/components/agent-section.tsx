import { Brain, Sparkles, Cpu, Atom, TrendingUp, TrendingDown, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { Agent, PerformanceMetrics, Trade, Position, Market } from "@shared/schema";

interface AgentSectionProps {
  agents: Agent[];
  metricsMap: Map<string, PerformanceMetrics>;
  tradesMap: Map<string, Trade[]>;
  positionsMap: Map<string, Position[]>;
  markets: Market[];
}

const agentIcons: Record<string, typeof Brain> = {
  "GPT-5": Sparkles,
  "Grok": Brain,
  "Claude": Cpu,
  "Gemini": Atom,
};

const agentColors: Record<string, string> = {
  "GPT-5": "text-teal-500 bg-teal-500/10",
  "Grok": "text-purple-500 bg-purple-500/10",
  "Claude": "text-orange-500 bg-orange-500/10",
  "Gemini": "text-blue-500 bg-blue-500/10",
};

function AgentDetails({ 
  agent, 
  metrics, 
  trades, 
  positions,
  markets 
}: { 
  agent: Agent;
  metrics: PerformanceMetrics | null;
  trades: Trade[];
  positions: Position[];
  markets: Market[];
}) {
  const Icon = agentIcons[agent.name] || Brain;
  const colorClass = agentColors[agent.name] || "text-muted-foreground bg-muted";
  const marketMap = new Map(markets.map(m => [m.id, m]));

  const pnl = metrics ? parseFloat(metrics.netPnl) : 0;
  const winRate = metrics ? parseFloat(metrics.winRate) * 100 : 0;
  const sharpe = metrics ? parseFloat(metrics.sharpeRatio || "0") : 0;
  const drawdown = metrics ? parseFloat(metrics.maxDrawdown || "0") * 100 : 0;

  const recentTrades = trades.slice(0, 3);

  return (
    <AccordionItem value={agent.id} className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline py-4">
        <div className="flex items-center gap-3 text-left">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", colorClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">{agent.name}</h3>
            <p className="text-xs text-muted-foreground">{agent.model}</p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-sm font-medium mb-1">Strategy</p>
            <p className="text-sm text-muted-foreground">{agent.strategyDescription}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <TrendingUp className="h-3 w-3" />
                Net PnL
              </div>
              <p className={cn(
                "font-mono font-semibold",
                pnl >= 0 ? "text-chart-2" : "text-destructive"
              )}>
                {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Target className="h-3 w-3" />
                Win Rate
              </div>
              <p className="font-mono font-semibold">{winRate.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground mb-1">Sharpe</div>
              <p className="font-mono font-semibold">{sharpe.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <TrendingDown className="h-3 w-3" />
                Max DD
              </div>
              <p className="font-mono font-semibold text-destructive">{drawdown.toFixed(1)}%</p>
            </div>
          </div>

          {positions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Current Positions</h4>
              <div className="space-y-2">
                {positions.map((pos) => {
                  const market = marketMap.get(pos.marketId);
                  const unrealizedPnl = parseFloat(pos.unrealizedPnl || "0");
                  return (
                    <div 
                      key={pos.id} 
                      className="flex items-center justify-between rounded-lg bg-muted/30 p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{market?.question || "Unknown"}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">{pos.side}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {parseFloat(pos.shares).toFixed(2)} shares
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className={cn(
                          "font-mono text-sm font-semibold",
                          unrealizedPnl >= 0 ? "text-chart-2" : "text-destructive"
                        )}>
                          {unrealizedPnl >= 0 ? "+" : ""}{unrealizedPnl.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {recentTrades.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Recent Reasoning</h4>
              <div className="space-y-2">
                {recentTrades.map((trade) => (
                  <div key={trade.id} className="rounded-lg bg-muted/30 p-3">
                    <p className="text-sm italic text-foreground/80">"{trade.reasoning}"</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {trade.action} {trade.side} - ${parseFloat(trade.sizeUsd).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function AgentSection({ agents, metricsMap, tradesMap, positionsMap, markets }: AgentSectionProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Agent Details</h2>
      <Accordion type="multiple" className="space-y-3" data-testid="container-agent-details">
        {agents.map((agent) => (
          <AgentDetails
            key={agent.id}
            agent={agent}
            metrics={metricsMap.get(agent.id) || null}
            trades={tradesMap.get(agent.id) || []}
            positions={positionsMap.get(agent.id) || []}
            markets={markets}
          />
        ))}
      </Accordion>
    </section>
  );
}
