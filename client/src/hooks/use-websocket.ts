import { useEffect, useRef, useState, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Agent, Trade, PerformanceMetrics, TickCycle } from "@shared/schema";

interface WebSocketMessage {
  type: string;
  data: unknown;
}

interface CycleCompleteData {
  cycle: TickCycle;
  summary: {
    tradesExecuted: number;
    marketsProcessed: number;
    agents: Agent[];
    metrics: PerformanceMetrics[];
  };
}

interface NewTradeData {
  trade: Trade;
  agent: Agent;
}

interface AlertData {
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  timestamp: string;
  agentId?: string;
  tradeId?: string;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  clientCount: number;
  reconnect: () => void;
  latestTrade: Trade | null;
  latestCycle: TickCycle | null;
}

export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
  const [clientCount, setClientCount] = useState(0);
  const [latestTrade, setLatestTrade] = useState<Trade | null>(null);
  const [latestCycle, setLatestCycle] = useState<TickCycle | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const isMountedRef = useRef(true);
  const { toast } = useToast();

  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (!isMountedRef.current) return;
    
    switch (message.type) {
      case "heartbeat": {
        const data = message.data as { clients: number };
        setClientCount(data.clients);
        break;
      }

      case "cycle_start": {
        const data = message.data as { cycle: TickCycle };
        setLatestCycle(data.cycle);
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        break;
      }

      case "cycle_complete": {
        const data = message.data as CycleCompleteData;
        setLatestCycle(data.cycle);
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
        queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
        
        toast({
          title: `Cycle #${data.cycle.cycleNumber} Complete`,
          description: `${data.summary.tradesExecuted} trades executed across ${data.summary.marketsProcessed} markets`,
        });
        break;
      }

      case "new_trade": {
        const data = message.data as NewTradeData;
        setLatestTrade(data.trade);
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
        
        const action = data.trade.action;
        const side = data.trade.side;
        toast({
          title: `${data.agent.name}: ${action} ${side}`,
          description: `$${parseFloat(data.trade.sizeUsd).toFixed(2)} at ${parseFloat(data.trade.price).toFixed(3)}`,
        });
        break;
      }

      case "alert": {
        const data = message.data as AlertData;
        queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/alerts/unread"] });
        toast({
          title: data.title,
          description: data.message,
          variant: data.severity === "critical" ? "destructive" : "default",
        });
        break;
      }

      case "dashboard_update":
      case "agent_update": {
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        break;
      }

      case "system_log": {
        queryClient.invalidateQueries({ queryKey: ["/api/system/logs"] });
        break;
      }
    }
  }, [toast]);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus("connecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        setIsConnected(true);
        setConnectionStatus("connected");
        reconnectAttempts.current = 0;
        
        ws.send(JSON.stringify({ type: "subscribe" }));
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          setLastMessage(message);
          handleMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setIsConnected(false);
        setConnectionStatus("disconnected");
        wsRef.current = null;

        // Attempt to reconnect with exponential backoff
        const maxAttempts = 10;
        if (reconnectAttempts.current < maxAttempts && isMountedRef.current) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, delay);
        }
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        setConnectionStatus("error");
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setConnectionStatus("error");
    }
  }, [handleMessage]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected,
    lastMessage,
    connectionStatus,
    clientCount,
    reconnect,
    latestTrade,
    latestCycle,
  };
}
