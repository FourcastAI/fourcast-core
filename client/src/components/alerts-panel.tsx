import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  Check, 
  X, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Activity 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  agentId?: string;
  tradeId?: string;
  marketId?: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
}

interface UnreadResponse {
  alerts: Alert[];
  count: number;
}

export function AlertsPanel() {
  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 30000,
  });

  const { data: unreadData } = useQuery<UnreadResponse>({
    queryKey: ["/api/alerts/unread"],
    refetchInterval: 10000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/alerts/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/unread"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/alerts/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/unread"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/alerts/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/unread"] });
    },
  });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "large_win":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "large_loss":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "risk_breach":
        return <Shield className="h-4 w-4 text-yellow-500" />;
      case "system_error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "market_opportunity":
        return <Activity className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "warning":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "info":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const unreadCount = unreadData?.count || 0;

  return (
    <Card data-testid="card-alerts-panel">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <CardTitle className="text-base">Alerts</CardTitle>
          {unreadCount > 0 && (
            <Badge variant="default" className="h-5 px-1.5 text-xs" data-testid="badge-unread-count">
              {unreadCount}
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            data-testid="button-mark-all-read"
          >
            <Check className="h-4 w-4 mr-1" />
            Mark all read
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-muted-foreground text-sm" data-testid="text-loading-alerts">Loading alerts...</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground" data-testid="empty-alerts-state">
            <Bell className="h-8 w-8 mb-2 opacity-50" />
            <span className="text-sm" data-testid="text-no-alerts">No alerts</span>
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-1 px-4 pb-4">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`relative p-3 rounded-md border ${
                    !alert.isRead ? "bg-muted/50" : ""
                  }`}
                  data-testid={`alert-item-${alert.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getAlertIcon(alert.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          {alert.title}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getSeverityColor(alert.severity)}`}
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {alert.message}
                      </p>
                      <span className="text-xs text-muted-foreground mt-1 block">
                        {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {!alert.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => markReadMutation.mutate(alert.id)}
                          data-testid={`button-read-${alert.id}`}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => dismissMutation.mutate(alert.id)}
                        data-testid={`button-dismiss-${alert.id}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
