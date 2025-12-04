import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock, 
  BarChart3, 
  Activity,
  Percent,
  DollarSign
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PerformanceMetrics } from "@shared/schema";

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: typeof TrendingUp;
  trend?: "up" | "down" | "neutral";
}

function MetricCard({ label, value, subValue, icon: Icon, trend }: MetricCardProps) {
  return (
    <Card className="hover-elevate">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          trend === "up" && "bg-chart-2/10 text-chart-2",
          trend === "down" && "bg-destructive/10 text-destructive",
          (!trend || trend === "neutral") && "bg-muted text-muted-foreground"
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold truncate">{value}</span>
            {subValue && (
              <span className="text-xs text-muted-foreground">{subValue}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricsPanelProps {
  metrics: PerformanceMetrics[];
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  const totalPnl = metrics.reduce((sum, m) => sum + parseFloat(m.netPnl), 0);
  const avgSharpe = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + parseFloat(m.sharpeRatio || "0"), 0) / metrics.length 
    : 0;
  const maxDrawdown = Math.min(...metrics.map(m => parseFloat(m.maxDrawdown || "0")));
  const avgWinRate = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + parseFloat(m.winRate || "0"), 0) / metrics.length * 100
    : 0;
  const totalTrades = metrics.reduce((sum, m) => sum + (m.totalTrades || 0), 0);
  const avgHoldTime = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + (m.avgHoldingTime || 0), 0) / metrics.length
    : 0;

  const formatHoldTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
    return `${(minutes / 1440).toFixed(1)}d`;
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Aggregate Metrics</h2>
      <div 
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        data-testid="container-metrics"
      >
        <MetricCard
          label="Total PnL"
          value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`}
          icon={DollarSign}
          trend={totalPnl > 0 ? "up" : totalPnl < 0 ? "down" : "neutral"}
        />
        <MetricCard
          label="Avg Sharpe"
          value={avgSharpe.toFixed(2)}
          icon={BarChart3}
          trend={avgSharpe > 1 ? "up" : avgSharpe < 0 ? "down" : "neutral"}
        />
        <MetricCard
          label="Max Drawdown"
          value={`${(maxDrawdown * 100).toFixed(1)}%`}
          icon={TrendingDown}
          trend={maxDrawdown > -0.1 ? "neutral" : "down"}
        />
        <MetricCard
          label="Avg Win Rate"
          value={`${avgWinRate.toFixed(1)}%`}
          icon={Target}
          trend={avgWinRate > 50 ? "up" : avgWinRate < 40 ? "down" : "neutral"}
        />
        <MetricCard
          label="Total Trades"
          value={totalTrades.toString()}
          icon={Activity}
          trend="neutral"
        />
        <MetricCard
          label="Avg Hold Time"
          value={formatHoldTime(avgHoldTime)}
          icon={Clock}
          trend="neutral"
        />
      </div>
    </section>
  );
}
