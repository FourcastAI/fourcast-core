import { Clock, Database, Wifi, Server, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TickCycle, SystemLog } from "@shared/schema";

interface SystemStatusProps {
  lastCycle: TickCycle | null;
  recentLogs: SystemLog[];
  isConnected: boolean;
}

export function SystemStatus({ lastCycle, recentLogs, isConnected }: SystemStatusProps) {
  const errorLogs = recentLogs.filter((log) => log.level === "error").slice(0, 3);
  const hasErrors = errorLogs.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Server className="h-5 w-5" />
          System Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">API Connection</span>
            </div>
            <Badge 
              variant="outline" 
              className={cn(
                isConnected 
                  ? "border-chart-2/50 bg-chart-2/10 text-chart-2" 
                  : "border-destructive/50 bg-destructive/10 text-destructive"
              )}
            >
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Database</span>
            </div>
            <Badge 
              variant="outline" 
              className="border-chart-2/50 bg-chart-2/10 text-chart-2"
            >
              Healthy
            </Badge>
          </div>
        </div>

        {lastCycle && (
          <div className="rounded-lg bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Last Cycle</span>
              </div>
              <span className="font-mono text-sm">#{lastCycle.cycleNumber}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Markets</p>
                <p className="font-mono text-sm">{lastCycle.marketsProcessed || 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Trades</p>
                <p className="font-mono text-sm">{lastCycle.tradesExecuted || 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Errors</p>
                <p className="font-mono text-sm">{lastCycle.errorCount || 0}</p>
              </div>
            </div>
          </div>
        )}

        {hasErrors ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Recent Errors</span>
            </div>
            {errorLogs.map((log) => (
              <div key={log.id} className="rounded-lg bg-destructive/10 p-2 text-xs">
                <span className="text-destructive">{log.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-chart-2">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">All systems operational</span>
          </div>
        )}

        <div 
          className="text-xs text-muted-foreground" 
          data-testid="text-system-status"
        >
          Trading cycles run every 15 minutes. Data sources: Polymarket, X, Brave Search.
        </div>
      </CardContent>
    </Card>
  );
}
