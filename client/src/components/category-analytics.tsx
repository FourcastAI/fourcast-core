import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, BarChart3, Target, DollarSign, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent, Trade, Market, PerformanceMetrics } from "@shared/schema";

interface CategoryAnalyticsProps {
  agents: Agent[];
  trades: Trade[];
  markets: Market[];
  metricsMap: Map<string, PerformanceMetrics>;
}

interface CategoryStats {
  category: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalVolume: number;
  avgTradeSize: number;
  bestAgent: string | null;
  bestAgentPnL: number;
  agentBreakdown: {
    agentId: string;
    agentName: string;
    trades: number;
    pnl: number;
    winRate: number;
    color: string;
  }[];
}

const categoryOrder = ["Politics", "Economics", "Crypto", "Sports", "Technology", "Entertainment", "Other"];

const categoryIcons: Record<string, string> = {
  Politics: "Politics",
  Economics: "Economics", 
  Crypto: "Crypto",
  Sports: "Sports",
  Technology: "Technology",
  Entertainment: "Entertainment",
  Other: "Other",
};

export function CategoryAnalytics({ agents, trades, markets, metricsMap }: CategoryAnalyticsProps) {
  const categoryStats = useMemo(() => {
    const marketCategoryMap = new Map<string, string>();
    const marketPriceMap = new Map<string, number>();
    
    markets.forEach((m) => {
      marketCategoryMap.set(m.id, m.category || "Other");
      marketPriceMap.set(m.id, parseFloat(m.yesPrice?.toString() || "0.5"));
    });

    const stats: Record<string, CategoryStats> = {};

    categoryOrder.forEach((cat) => {
      stats[cat] = {
        category: cat,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnL: 0,
        totalVolume: 0,
        avgTradeSize: 0,
        bestAgent: null,
        bestAgentPnL: 0,
        agentBreakdown: agents.map((a) => ({
          agentId: a.id,
          agentName: a.name,
          trades: 0,
          pnl: 0,
          winRate: 0,
          color: a.color,
        })),
      };
    });

    trades.forEach((trade) => {
      const rawCategory = marketCategoryMap.get(trade.marketId) || "Other";
      const category = categoryOrder.find(
        (c) => c.toLowerCase() === rawCategory.toLowerCase()
      ) || "Other";
      
      const agent = agents.find((a) => a.id === trade.agentId);
      if (!agent) return;

      const tradeSize = parseFloat(trade.sizeUsd);
      const isWinning = trade.action === "BUY" && trade.status === "executed";
      const estimatedPnL = trade.action === "BUY" 
        ? tradeSize * 0.05 
        : trade.action === "SELL" 
        ? tradeSize * 0.03 
        : 0;

      stats[category].totalTrades += 1;
      stats[category].totalVolume += tradeSize;
      if (isWinning) {
        stats[category].winningTrades += 1;
        stats[category].totalPnL += estimatedPnL;
      } else if (trade.action === "SELL") {
        stats[category].losingTrades += 1;
        stats[category].totalPnL -= estimatedPnL * 0.5;
      }

      const agentBreakdown = stats[category].agentBreakdown.find(
        (ab) => ab.agentId === agent.id
      );
      if (agentBreakdown) {
        agentBreakdown.trades += 1;
        agentBreakdown.pnl += isWinning ? estimatedPnL : -estimatedPnL * 0.5;
      }
    });

    Object.values(stats).forEach((stat) => {
      if (stat.totalTrades > 0) {
        stat.winRate = (stat.winningTrades / stat.totalTrades) * 100;
        stat.avgTradeSize = stat.totalVolume / stat.totalTrades;
      }

      stat.agentBreakdown.forEach((ab) => {
        if (ab.trades > 0) {
          const agentWins = trades.filter(
            (t) =>
              t.agentId === ab.agentId &&
              (marketCategoryMap.get(t.marketId) || "Other").toLowerCase() ===
                stat.category.toLowerCase() &&
              t.action === "BUY" &&
              t.status === "executed"
          ).length;
          ab.winRate = (agentWins / ab.trades) * 100;
        }
      });

      const sortedAgents = [...stat.agentBreakdown].sort((a, b) => b.pnl - a.pnl);
      if (sortedAgents[0] && sortedAgents[0].pnl > 0) {
        stat.bestAgent = sortedAgents[0].agentName;
        stat.bestAgentPnL = sortedAgents[0].pnl;
      }
    });

    return Object.values(stats).filter((s) => s.totalTrades > 0 || true);
  }, [agents, trades, markets]);

  const totalTrades = categoryStats.reduce((acc, cat) => acc + cat.totalTrades, 0);
  const totalPnL = categoryStats.reduce((acc, cat) => acc + cat.totalPnL, 0);
  const topCategory = categoryStats.reduce(
    (best, cat) => (cat.totalPnL > best.totalPnL ? cat : best),
    categoryStats[0]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Category Analytics
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Target className="h-3 w-3" />
              {totalTrades} trades
            </Badge>
            <Badge 
              variant="outline" 
              className={cn(
                "gap-1",
                totalPnL >= 0 
                  ? "border-chart-2/50 bg-chart-2/10 text-chart-2" 
                  : "border-destructive/50 bg-destructive/10 text-destructive"
              )}
            >
              {totalPnL >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              ${Math.abs(totalPnL).toFixed(2)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4" data-testid="container-category-analytics">
        {categoryStats.length === 0 || totalTrades === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No trading data yet</p>
            <p className="text-xs mt-1">Category analytics will appear once trades are executed</p>
          </div>
        ) : (
          <div className="space-y-3">
            {categoryStats
              .sort((a, b) => b.totalTrades - a.totalTrades)
              .map((cat) => (
                <div
                  key={cat.category}
                  className="rounded-lg border bg-card p-3 space-y-3"
                  data-testid={`category-card-${cat.category.toLowerCase()}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{cat.category}</span>
                      {cat.category === topCategory?.category && cat.totalPnL > 0 && (
                        <Badge variant="outline" className="text-xs border-chart-1/50 bg-chart-1/10 text-chart-1">
                          Top
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {cat.totalTrades} trades
                      </span>
                      <span
                        className={cn(
                          "font-mono font-medium",
                          cat.totalPnL >= 0 ? "text-chart-2" : "text-destructive"
                        )}
                      >
                        {cat.totalPnL >= 0 ? "+" : ""}${cat.totalPnL.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Percent className="h-3 w-3" />
                        <span className="text-xs">Win Rate</span>
                      </div>
                      <p className="font-mono font-medium">
                        {cat.winRate.toFixed(1)}%
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        <span className="text-xs">Avg Size</span>
                      </div>
                      <p className="font-mono font-medium">
                        ${cat.avgTradeSize.toFixed(0)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Target className="h-3 w-3" />
                        <span className="text-xs">Volume</span>
                      </div>
                      <p className="font-mono font-medium">
                        ${cat.totalVolume.toFixed(0)}
                      </p>
                    </div>
                  </div>

                  {cat.agentBreakdown.some((ab) => ab.trades > 0) && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Agent breakdown</p>
                      <div className="grid gap-2">
                        {cat.agentBreakdown
                          .filter((ab) => ab.trades > 0)
                          .sort((a, b) => b.pnl - a.pnl)
                          .map((ab) => (
                            <div key={ab.agentId} className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: ab.color }}
                              />
                              <span className="text-sm w-16 flex-shrink-0">{ab.agentName}</span>
                              <div className="flex-1">
                                <Progress
                                  value={Math.min(100, (ab.trades / cat.totalTrades) * 100)}
                                  className="h-2"
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-10 text-right">
                                {ab.trades}
                              </span>
                              <span
                                className={cn(
                                  "text-xs font-mono w-14 text-right",
                                  ab.pnl >= 0 ? "text-chart-2" : "text-destructive"
                                )}
                              >
                                {ab.pnl >= 0 ? "+" : ""}${ab.pnl.toFixed(0)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {cat.bestAgent && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-chart-2" />
                      Best performer: <span className="font-medium text-foreground">{cat.bestAgent}</span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
