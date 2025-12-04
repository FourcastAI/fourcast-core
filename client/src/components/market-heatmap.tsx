import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Agent, Trade, Market } from "@shared/schema";

interface MarketHeatmapProps {
  agents: Agent[];
  trades: Trade[];
  markets: Market[];
}

const categories = ["Politics", "Economics", "Crypto", "Sports", "Technology", "Entertainment"];

export function MarketHeatmap({ agents, trades, markets }: MarketHeatmapProps) {
  const heatmapData = useMemo(() => {
    const marketCategoryMap = new Map<string, string>();
    markets.forEach((m) => {
      marketCategoryMap.set(m.id, m.category || "Other");
    });

    const data: Record<string, Record<string, { pnl: number; trades: number }>> = {};
    
    agents.forEach((agent) => {
      data[agent.name] = {};
      categories.forEach((cat) => {
        data[agent.name][cat] = { pnl: 0, trades: 0 };
      });
    });

    trades.forEach((trade) => {
      const agent = agents.find((a) => a.id === trade.agentId);
      if (!agent) return;

      const category = marketCategoryMap.get(trade.marketId) || "Other";
      const matchedCategory = categories.find(
        (c) => c.toLowerCase() === category.toLowerCase()
      );
      
      if (matchedCategory && data[agent.name][matchedCategory]) {
        const tradePnl = parseFloat(trade.sizeUsd) * (trade.action === "BUY" ? 0.02 : -0.01);
        data[agent.name][matchedCategory].pnl += tradePnl;
        data[agent.name][matchedCategory].trades += 1;
      }
    });

    return data;
  }, [agents, trades, markets]);

  const getColorIntensity = (pnl: number) => {
    if (pnl === 0) return "bg-muted";
    if (pnl > 0) {
      if (pnl > 50) return "bg-chart-2 text-white";
      if (pnl > 20) return "bg-chart-2/70 text-white";
      return "bg-chart-2/40";
    } else {
      if (pnl < -50) return "bg-destructive text-white";
      if (pnl < -20) return "bg-destructive/70 text-white";
      return "bg-destructive/40";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Performance by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto" data-testid="chart-heatmap">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-sm font-medium text-muted-foreground p-2">Agent</th>
                {categories.map((cat) => (
                  <th key={cat} className="text-center text-sm font-medium text-muted-foreground p-2">
                    {cat}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td className="text-sm font-medium p-2">{agent.name}</td>
                  {categories.map((cat) => {
                    const cellData = heatmapData[agent.name]?.[cat] || { pnl: 0, trades: 0 };
                    return (
                      <td key={cat} className="p-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "h-12 rounded-md flex items-center justify-center font-mono text-sm font-medium cursor-default transition-colors",
                                getColorIntensity(cellData.pnl)
                              )}
                            >
                              {cellData.pnl !== 0 && (
                                <span>
                                  {cellData.pnl > 0 ? "+" : ""}{cellData.pnl.toFixed(0)}
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-semibold">{agent.name} - {cat}</p>
                            <p>PnL: ${cellData.pnl.toFixed(2)}</p>
                            <p>Trades: {cellData.trades}</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
