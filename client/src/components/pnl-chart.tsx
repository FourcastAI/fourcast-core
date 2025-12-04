import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PerformanceMetrics, Agent } from "@shared/schema";

interface PnLChartProps {
  agents: Agent[];
  metricsHistory: Map<string, PerformanceMetrics[]>;
}

const agentColorValues: Record<string, string> = {
  "GPT-5": "#14b8a6",
  "Grok": "#a855f7",
  "Claude": "#f97316",
  "Gemini": "#3b82f6",
};

export function PnLChart({ agents, metricsHistory }: PnLChartProps) {
  const chartData = useMemo(() => {
    const allTimestamps = new Set<string>();
    
    metricsHistory.forEach((metrics) => {
      metrics.forEach((m) => {
        if (m.timestamp) {
          allTimestamps.add(new Date(m.timestamp).toISOString());
        }
      });
    });

    const sortedTimestamps = Array.from(allTimestamps).sort();
    
    if (sortedTimestamps.length === 0) {
      const now = new Date();
      return [
        {
          time: "Start",
          ...Object.fromEntries(agents.map(a => [a.name, 0])),
        },
        {
          time: "Now",
          ...Object.fromEntries(agents.map(a => [a.name, 0])),
        },
      ];
    }

    return sortedTimestamps.map((ts, index) => {
      const point: Record<string, number | string> = {
        time: new Date(ts).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      agents.forEach((agent) => {
        const agentMetrics = metricsHistory.get(agent.id) || [];
        const closestMetric = agentMetrics.find(
          (m) => m.timestamp && new Date(m.timestamp).toISOString() === ts
        );
        point[agent.name] = closestMetric ? parseFloat(closestMetric.netPnl) : 0;
      });

      return point;
    });
  }, [agents, metricsHistory]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">PnL Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]" data-testid="chart-pnl">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend />
              {agents.map((agent) => (
                <Line
                  key={agent.id}
                  type="monotone"
                  dataKey={agent.name}
                  stroke={agentColorValues[agent.name] || "#888"}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
