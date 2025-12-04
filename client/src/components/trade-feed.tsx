import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  Brain, Sparkles, Cpu, Atom, ChevronDown, ChevronUp, 
  Target, TrendingUp, TrendingDown, DollarSign, 
  BarChart3, MessageSquare, Gauge, AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Trade, Agent, Market } from "@shared/schema";

interface TradeWithDetails extends Trade {
  agent?: Agent;
  market?: Market;
}

interface TradeFeedProps {
  trades: TradeWithDetails[];
  agents: Agent[];
  markets: Market[];
}

const agentIcons: Record<string, typeof Brain> = {
  "GPT-5": Sparkles,
  "Grok": Brain,
  "Claude": Cpu,
  "Gemini": Atom,
};

const agentColors: Record<string, string> = {
  "GPT-5": "bg-teal-500",
  "Grok": "bg-purple-500",
  "Claude": "bg-orange-500",
  "Gemini": "bg-blue-500",
};

function extractConfidence(reasoning: string): number {
  const confidencePatterns = [
    /confidence[:\s]+(\d+)%?/i,
    /(\d+)%\s*confident/i,
    /(\d+)%\s*probability/i,
    /certainty[:\s]+(\d+)%?/i,
  ];
  
  for (const pattern of confidencePatterns) {
    const match = reasoning.match(pattern);
    if (match) {
      return Math.min(100, Math.max(0, parseInt(match[1])));
    }
  }
  
  const lowerReasoning = reasoning.toLowerCase();
  if (lowerReasoning.includes("highly confident") || lowerReasoning.includes("very likely")) {
    return 85;
  } else if (lowerReasoning.includes("confident") || lowerReasoning.includes("likely")) {
    return 70;
  } else if (lowerReasoning.includes("moderate") || lowerReasoning.includes("possible")) {
    return 55;
  } else if (lowerReasoning.includes("uncertain") || lowerReasoning.includes("risky")) {
    return 40;
  }
  
  return 60;
}

function getPositionSizeRationale(sizeUsd: number): string {
  if (sizeUsd >= 45) {
    return "Max position (10% of portfolio)";
  } else if (sizeUsd >= 35) {
    return "Large position (high conviction)";
  } else if (sizeUsd >= 25) {
    return "Medium position (standard)";
  } else if (sizeUsd >= 15) {
    return "Small position (conservative)";
  } else {
    return "Minimal position (testing)";
  }
}

function TradeRow({ trade, agent, market }: { trade: Trade; agent?: Agent; market?: Market }) {
  const [expanded, setExpanded] = useState(false);
  
  const Icon = agent ? agentIcons[agent.name] || Brain : Brain;
  const colorClass = agent ? agentColors[agent.name] || "bg-muted" : "bg-muted";
  
  const actionColors: Record<string, string> = {
    BUY: "bg-chart-2/10 text-chart-2 border-chart-2/30",
    SELL: "bg-destructive/10 text-destructive border-destructive/30",
    HOLD: "bg-muted text-muted-foreground border-muted-foreground/30",
  };

  const timeAgo = trade.executedAt 
    ? formatDistanceToNow(new Date(trade.executedAt), { addSuffix: true })
    : "just now";

  return (
    <div 
      className="group border-b border-border/50 last:border-0"
      data-testid={`trade-row-${trade.id}`}
    >
      <div className="flex items-center gap-3 p-3">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-white", colorClass)}>
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{agent?.name || "Unknown"}</span>
            <Badge 
              variant="outline" 
              className={cn("text-xs", actionColors[trade.action])}
            >
              {trade.action}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {trade.side}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {market?.question || "Unknown market"}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="font-mono text-sm font-semibold">
            ${parseFloat(trade.sizeUsd).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setExpanded(!expanded)}
          data-testid={`button-expand-trade-${trade.id}`}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {expanded && (
        <div className="bg-muted/30 px-3 pb-3 pt-1 space-y-3">
          <div className="rounded-lg bg-background/50 p-3 space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">AI Reasoning</p>
              </div>
              <p className="text-sm italic text-foreground/80">"{trade.reasoning}"</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <Gauge className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Confidence</span>
                </div>
                <div className="space-y-1">
                  <Progress 
                    value={extractConfidence(trade.reasoning)} 
                    className="h-2"
                  />
                  <p className="text-xs font-mono text-right">
                    {extractConfidence(trade.reasoning)}%
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Position Size</span>
                </div>
                <div>
                  <p className="font-mono text-sm font-medium">${parseFloat(trade.sizeUsd).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {getPositionSizeRationale(parseFloat(trade.sizeUsd))}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-xs">
              <div className="flex flex-col">
                <span className="text-muted-foreground mb-1 flex items-center gap-1">
                  <Target className="h-3 w-3" /> Entry Price
                </span>
                <span className="font-mono">{parseFloat(trade.price).toFixed(3)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground mb-1 flex items-center gap-1">
                  {trade.action === "BUY" ? (
                    <TrendingUp className="h-3 w-3 text-chart-2" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-destructive" />
                  )}
                  Action
                </span>
                <span className={cn(
                  "font-medium",
                  trade.action === "BUY" ? "text-chart-2" : "text-destructive"
                )}>
                  {trade.action} {trade.side}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground mb-1 flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" /> Status
                </span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs w-fit",
                    trade.status === "executed" && "border-chart-2/50 bg-chart-2/10 text-chart-2",
                    trade.status === "pending" && "border-chart-1/50 bg-chart-1/10 text-chart-1",
                    trade.status === "failed" && "border-destructive/50 bg-destructive/10 text-destructive"
                  )}
                >
                  {trade.status}
                </Badge>
              </div>
            </div>

            {market && (
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <BarChart3 className="h-3 w-3" />
                  <span>Market Info</span>
                </div>
                <div className="bg-muted/50 rounded p-2 text-xs">
                  <p className="font-medium truncate">{market.question}</p>
                  <div className="flex items-center gap-3 mt-1 text-muted-foreground">
                    <span>Category: {market.category}</span>
                    <span>Volume: ${parseFloat(market.volume?.toString() || "0").toFixed(0)}</span>
                    <span>Yes: {(parseFloat(market.yesPrice?.toString() || "0.5") * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            )}

            {trade.errorMessage && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded p-2">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{trade.errorMessage}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TradeFeed({ trades, agents, markets }: TradeFeedProps) {
  const agentMap = new Map(agents.map(a => [a.id, a]));
  const marketMap = new Map(markets.map(m => [m.id, m]));

  const sortedTrades = [...trades].sort((a, b) => {
    const dateA = a.executedAt ? new Date(a.executedAt).getTime() : 0;
    const dateB = b.executedAt ? new Date(b.executedAt).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-2 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-chart-2"></span>
          </span>
          Recent Trades
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]" data-testid="container-trade-feed">
          {sortedTrades.length > 0 ? (
            sortedTrades.slice(0, 20).map((trade) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                agent={agentMap.get(trade.agentId)}
                market={marketMap.get(trade.marketId)}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-3">
                <Brain className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No trades yet. Agents are analyzing markets...
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
