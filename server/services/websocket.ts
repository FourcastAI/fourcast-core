import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { logger } from "./logger";
import type { Agent, Trade, Position, PerformanceMetrics, TickCycle, SystemLog } from "@shared/schema";

interface WebSocketMessage {
  type: string;
  data: unknown;
}

interface DashboardUpdate {
  agents?: Agent[];
  trades?: Trade[];
  positions?: Position[];
  metrics?: PerformanceMetrics[];
  cycle?: TickCycle;
  log?: SystemLog;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: "/ws"
    });

    this.wss.on("connection", (ws: WebSocket) => {
      this.clients.add(ws);
      logger.info(`WebSocket client connected. Total clients: ${this.clients.size}`, {
        source: "websocket"
      });

      ws.send(JSON.stringify({
        type: "connected",
        data: { message: "Connected to FOURCAST real-time feed" }
      }));

      ws.on("message", (message: Buffer) => {
        try {
          const parsed = JSON.parse(message.toString()) as WebSocketMessage;
          this.handleMessage(ws, parsed);
        } catch (error) {
          ws.send(JSON.stringify({
            type: "error",
            data: { message: "Invalid message format" }
          }));
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        logger.info(`WebSocket client disconnected. Total clients: ${this.clients.size}`, {
          source: "websocket"
        });
      });

      ws.on("error", (error) => {
        logger.error(`WebSocket error: ${error.message}`, {
          source: "websocket",
          metadata: { error: String(error) }
        });
        this.clients.delete(ws);
      });
    });

    this.startHeartbeat();

    logger.info("WebSocket server initialized on /ws", { source: "websocket" });
  }

  private handleMessage(ws: WebSocket, message: WebSocketMessage): void {
    switch (message.type) {
      case "ping":
        ws.send(JSON.stringify({ type: "pong", data: { timestamp: Date.now() } }));
        break;
      case "subscribe":
        ws.send(JSON.stringify({ 
          type: "subscribed", 
          data: { channels: ["dashboard", "trades", "alerts"] } 
        }));
        break;
      default:
        ws.send(JSON.stringify({ 
          type: "unknown", 
          data: { message: `Unknown message type: ${message.type}` } 
        }));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.broadcast({
        type: "heartbeat",
        data: { timestamp: Date.now(), clients: this.clients.size }
      });
    }, 30000);
  }

  broadcast(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  broadcastDashboardUpdate(update: DashboardUpdate): void {
    this.broadcast({
      type: "dashboard_update",
      data: update
    });
  }

  broadcastNewTrade(trade: Trade, agent: Agent): void {
    this.broadcast({
      type: "new_trade",
      data: { trade, agent }
    });
  }

  broadcastCycleStart(cycle: TickCycle): void {
    this.broadcast({
      type: "cycle_start",
      data: { cycle }
    });
  }

  broadcastCycleComplete(cycle: TickCycle, summary: { 
    tradesExecuted: number; 
    marketsProcessed: number;
    agents: Agent[];
    metrics: PerformanceMetrics[];
  }): void {
    this.broadcast({
      type: "cycle_complete",
      data: { cycle, summary }
    });
  }

  broadcastAlert(alert: {
    type: string;
    severity: "info" | "warning" | "critical";
    title: string;
    message: string;
    agentId?: string;
    tradeId?: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.broadcast({
      type: "alert",
      data: { 
        ...alert,
        timestamp: new Date().toISOString()
      }
    });
  }

  broadcastAgentUpdate(agent: Agent, metrics?: PerformanceMetrics): void {
    this.broadcast({
      type: "agent_update",
      data: { agent, metrics }
    });
  }

  broadcastLog(log: SystemLog): void {
    this.broadcast({
      type: "system_log",
      data: log
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.clients.forEach((client) => {
      client.close(1000, "Server shutting down");
    });
    
    this.wss?.close();
    logger.info("WebSocket server shut down", { source: "websocket" });
  }
}

export const websocketService = new WebSocketService();
