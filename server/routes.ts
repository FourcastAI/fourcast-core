import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { scheduler } from "./services/scheduler";
import { aiAgentService } from "./services/ai-agents";
import { logger } from "./services/logger";
import { config, validateEnv, getConfiguredProviders } from "./config";
import { websocketService } from "./services/websocket";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Enable CORS for public API access
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Initialize WebSocket server
  websocketService.initialize(httpServer);

  // Dashboard endpoint - aggregates all data needed for the frontend
  app.get("/api/dashboard", async (req, res) => {
    try {
      const [agents, metrics, trades, positions, markets, lastCycle, logs] = await Promise.all([
        storage.getAgents(),
        storage.getLatestMetrics(),
        storage.getTrades(50),
        storage.getPositions(),
        storage.getMarkets(),
        storage.getLastCycle(),
        storage.getLogs(20),
      ]);

      // Get all metrics for charts (not just latest)
      const allMetrics = await Promise.all(
        agents.map(async (agent) => {
          const agentMetrics = await storage.getMetricsByAgent(agent.id);
          return agentMetrics;
        })
      );

      const flatMetrics = allMetrics.flat();

      res.json({
        agents,
        metrics: flatMetrics,
        trades,
        positions,
        markets,
        lastCycle,
        logs,
      });
    } catch (error) {
      logger.error(`Dashboard API error: ${error}`, {
        source: "api",
        metadata: { error: String(error) },
      });
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  // Agents endpoints
  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAgents();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agent" });
    }
  });

  app.get("/api/agents/:id/metrics", async (req, res) => {
    try {
      const metrics = await storage.getMetricsByAgent(req.params.id);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agent metrics" });
    }
  });

  app.get("/api/agents/:id/trades", async (req, res) => {
    try {
      const trades = await storage.getTradesByAgent(req.params.id);
      res.json(trades);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agent trades" });
    }
  });

  app.get("/api/agents/:id/positions", async (req, res) => {
    try {
      const positions = await storage.getPositionsByAgent(req.params.id);
      res.json(positions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agent positions" });
    }
  });

  // Markets endpoints
  app.get("/api/markets", async (req, res) => {
    try {
      const markets = await storage.getMarkets();
      res.json(markets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch markets" });
    }
  });

  app.get("/api/markets/:id", async (req, res) => {
    try {
      const market = await storage.getMarket(req.params.id);
      if (!market) {
        return res.status(404).json({ error: "Market not found" });
      }
      res.json(market);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch market" });
    }
  });

  app.get("/api/markets/:id/snapshots", async (req, res) => {
    try {
      const snapshots = await storage.getMarketSnapshots(req.params.id);
      res.json(snapshots);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch market snapshots" });
    }
  });

  // Trades endpoints
  app.get("/api/trades", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const trades = await storage.getTrades(limit);
      res.json(trades);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trades" });
    }
  });

  // Positions endpoints
  app.get("/api/positions", async (req, res) => {
    try {
      const positions = await storage.getPositions();
      res.json(positions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch positions" });
    }
  });

  // Performance metrics endpoints
  app.get("/api/metrics", async (req, res) => {
    try {
      const metrics = await storage.getLatestMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  // Leaderboard endpoint
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const agents = await storage.getAgents();
      const metricsMap = new Map<string, any>();

      for (const agent of agents) {
        const agentMetrics = await storage.getMetricsByAgent(agent.id);
        if (agentMetrics.length > 0) {
          metricsMap.set(agent.id, agentMetrics[0]);
        }
      }

      // Sort by PnL
      const leaderboard = agents
        .map((agent, index) => ({
          rank: 0,
          agent,
          metrics: metricsMap.get(agent.id) || null,
          pnl: metricsMap.get(agent.id)?.netPnl 
            ? parseFloat(metricsMap.get(agent.id).netPnl) 
            : 0,
        }))
        .sort((a, b) => b.pnl - a.pnl)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));

      res.json(leaderboard);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // System status endpoints
  app.get("/api/system/status", async (req, res) => {
    try {
      const lastCycle = await storage.getLastCycle();
      const logs = await storage.getLogs(10);
      const envValidation = validateEnv();
      const configuredProviders = getConfiguredProviders();

      res.json({
        scheduler: {
          isRunning: scheduler.isActive(),
          currentCycle: scheduler.getCurrentCycle(),
          intervalMinutes: config.trading.tickIntervalMinutes,
        },
        websocket: {
          connectedClients: websocketService.getClientCount(),
        },
        lastCycle,
        recentLogs: logs,
        environment: {
          isValid: envValidation.isValid,
          missingRequired: envValidation.missing,
          configuredProviders,
        },
        simulation: !process.env.POLYMARKET_PRIVATE_KEY,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch system status" });
    }
  });

  app.get("/api/system/logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  // Scheduler control endpoints
  app.post("/api/scheduler/start", async (req, res) => {
    try {
      await scheduler.start();
      res.json({ success: true, message: "Scheduler started" });
    } catch (error) {
      res.status(500).json({ error: "Failed to start scheduler" });
    }
  });

  app.post("/api/scheduler/stop", async (req, res) => {
    try {
      await scheduler.stop();
      res.json({ success: true, message: "Scheduler stopped" });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop scheduler" });
    }
  });

  app.post("/api/scheduler/trigger", async (req, res) => {
    try {
      await scheduler.triggerCycle();
      res.json({ success: true, message: "Cycle triggered" });
    } catch (error) {
      res.status(500).json({ error: "Failed to trigger cycle" });
    }
  });

  // Initialize agents on startup
  app.post("/api/agents/initialize", async (req, res) => {
    try {
      const agents = await aiAgentService.initializeAgents();
      res.json({ success: true, agents });
    } catch (error) {
      res.status(500).json({ error: "Failed to initialize agents" });
    }
  });

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      // Check database connection
      await storage.getAgents();
      
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      });
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        error: String(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Configuration endpoint (read-only, no secrets)
  app.get("/api/config", (req, res) => {
    res.json({
      trading: config.trading,
      risk: config.risk,
      models: Object.entries(config.models).map(([key, value]) => ({
        key,
        name: value.name,
        model: value.model,
        provider: value.provider,
        color: value.color,
        strategy: value.strategy,
      })),
    });
  });

  // Alerts endpoints
  app.get("/api/alerts", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const alerts = await storage.getAlerts(limit);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.get("/api/alerts/unread", async (req, res) => {
    try {
      const alerts = await storage.getUnreadAlerts();
      res.json({ alerts, count: alerts.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unread alerts" });
    }
  });

  app.post("/api/alerts/:id/read", async (req, res) => {
    try {
      const alert = await storage.markAlertRead(req.params.id);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark alert as read" });
    }
  });

  app.post("/api/alerts/:id/dismiss", async (req, res) => {
    try {
      const alert = await storage.markAlertDismissed(req.params.id);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Failed to dismiss alert" });
    }
  });

  app.post("/api/alerts/read-all", async (req, res) => {
    try {
      await storage.markAllAlertsRead();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark all alerts as read" });
    }
  });

  // ============================================================
  // PUBLIC API ENDPOINTS - External Access
  // ============================================================

  // Public API: Get complete trading overview
  app.get("/api/v1/overview", async (req, res) => {
    try {
      const [agents, trades, positions, lastCycle] = await Promise.all([
        storage.getAgents(),
        storage.getTrades(20),
        storage.getPositions(),
        storage.getLastCycle(),
      ]);

      // Get latest metrics for each agent
      const agentData = await Promise.all(
        agents.map(async (agent) => {
          const metrics = await storage.getMetricsByAgent(agent.id);
          const latestMetrics = metrics[0];
          const agentTrades = trades.filter(t => t.agentId === agent.id);
          const agentPositions = positions.filter(p => p.agentId === agent.id);

          return {
            id: agent.id,
            name: agent.name,
            model: agent.model,
            provider: agent.provider,
            strategy: agent.strategyDescription,
            color: agent.color,
            balance: parseFloat(agent.currentBalance),
            performance: latestMetrics ? {
              netPnL: parseFloat(latestMetrics.netPnl),
              totalReturn: parseFloat(latestMetrics.totalReturn || "0"),
              winRate: parseFloat(latestMetrics.winRate?.toString() || "0"),
              sharpeRatio: parseFloat(latestMetrics.sharpeRatio?.toString() || "0"),
              maxDrawdown: parseFloat(latestMetrics.maxDrawdown?.toString() || "0"),
              totalTrades: latestMetrics.totalTrades,
              winningTrades: latestMetrics.winningTrades,
              losingTrades: latestMetrics.losingTrades,
            } : null,
            recentTrades: agentTrades.slice(0, 5).map(t => ({
              id: t.id,
              action: t.action,
              side: t.side,
              sizeUsd: parseFloat(t.sizeUsd),
              price: parseFloat(t.price),
              status: t.status,
              reasoning: t.reasoning,
              timestamp: t.createdAt,
            })),
            openPositions: agentPositions.length,
          };
        })
      );

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        cycle: lastCycle ? {
          number: lastCycle.cycleNumber,
          status: lastCycle.status,
          marketsProcessed: lastCycle.marketsProcessed,
          tradesExecuted: lastCycle.tradesExecuted,
          completedAt: lastCycle.completedAt,
        } : null,
        agents: agentData,
        totalAgents: agents.length,
        isSimulation: !process.env.POLYMARKET_PRIVATE_KEY,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch overview" });
    }
  });

  // Public API: Get all agent decisions with reasoning
  app.get("/api/v1/decisions", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const agentId = req.query.agent as string;

      let trades = await storage.getTrades(limit);
      
      if (agentId) {
        trades = trades.filter(t => t.agentId === agentId);
      }

      const agents = await storage.getAgents();
      const agentMap = new Map(agents.map(a => [a.id, a]));

      const decisions = trades.map(trade => {
        const agent = agentMap.get(trade.agentId);
        return {
          id: trade.id,
          timestamp: trade.createdAt,
          agent: agent ? {
            id: agent.id,
            name: agent.name,
            model: agent.model,
          } : null,
          decision: {
            action: trade.action,
            side: trade.side,
            sizeUsd: parseFloat(trade.sizeUsd),
            price: parseFloat(trade.price),
          },
          reasoning: trade.reasoning,
          status: trade.status,
          marketId: trade.marketId,
          pnl: trade.pnl ? parseFloat(trade.pnl) : null,
        };
      });

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        count: decisions.length,
        decisions,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch decisions" });
    }
  });

  // Public API: Get agent leaderboard with PnL
  app.get("/api/v1/leaderboard", async (req, res) => {
    try {
      const agents = await storage.getAgents();
      
      const leaderboard = await Promise.all(
        agents.map(async (agent) => {
          const metrics = await storage.getMetricsByAgent(agent.id);
          const latestMetrics = metrics[0];
          
          return {
            rank: 0,
            agent: {
              id: agent.id,
              name: agent.name,
              model: agent.model,
              provider: agent.provider,
              color: agent.color,
            },
            performance: {
              netPnL: latestMetrics ? parseFloat(latestMetrics.netPnl) : 0,
              totalReturn: latestMetrics ? parseFloat(latestMetrics.totalReturn || "0") : 0,
              winRate: latestMetrics ? parseFloat(latestMetrics.winRate?.toString() || "0") : 0,
              sharpeRatio: latestMetrics ? parseFloat(latestMetrics.sharpeRatio?.toString() || "0") : 0,
              totalTrades: latestMetrics?.totalTrades || 0,
            },
            balance: parseFloat(agent.currentBalance),
            initialBalance: parseFloat(agent.initialBalance),
          };
        })
      );

      // Sort by PnL and assign ranks
      leaderboard.sort((a, b) => b.performance.netPnL - a.performance.netPnL);
      leaderboard.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        leaderboard,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch leaderboard" });
    }
  });

  // Public API: Get specific agent details
  app.get("/api/v1/agents/:id", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ success: false, error: "Agent not found" });
      }

      const [metrics, trades, positions] = await Promise.all([
        storage.getMetricsByAgent(agent.id),
        storage.getTradesByAgent(agent.id),
        storage.getPositionsByAgent(agent.id),
      ]);

      const latestMetrics = metrics[0];

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        agent: {
          id: agent.id,
          name: agent.name,
          model: agent.model,
          provider: agent.provider,
          strategy: agent.strategyDescription,
          color: agent.color,
          isActive: agent.isActive,
          createdAt: agent.createdAt,
        },
        balance: {
          initial: parseFloat(agent.initialBalance),
          current: parseFloat(agent.currentBalance),
          change: parseFloat(agent.currentBalance) - parseFloat(agent.initialBalance),
        },
        performance: latestMetrics ? {
          netPnL: parseFloat(latestMetrics.netPnl),
          totalReturn: parseFloat(latestMetrics.totalReturn || "0"),
          winRate: parseFloat(latestMetrics.winRate?.toString() || "0"),
          sharpeRatio: parseFloat(latestMetrics.sharpeRatio?.toString() || "0"),
          maxDrawdown: parseFloat(latestMetrics.maxDrawdown?.toString() || "0"),
          totalTrades: latestMetrics.totalTrades,
          winningTrades: latestMetrics.winningTrades,
          losingTrades: latestMetrics.losingTrades,
          avgHoldTime: latestMetrics.avgHoldTime,
        } : null,
        recentTrades: trades.slice(0, 20).map(t => ({
          id: t.id,
          action: t.action,
          side: t.side,
          sizeUsd: parseFloat(t.sizeUsd),
          price: parseFloat(t.price),
          status: t.status,
          reasoning: t.reasoning,
          pnl: t.pnl ? parseFloat(t.pnl) : null,
          timestamp: t.createdAt,
        })),
        openPositions: positions.map(p => ({
          id: p.id,
          marketId: p.marketId,
          side: p.side,
          size: parseFloat(p.size),
          entryPrice: parseFloat(p.entryPrice),
          currentValue: p.currentValue ? parseFloat(p.currentValue) : null,
          unrealizedPnl: p.unrealizedPnl ? parseFloat(p.unrealizedPnl) : null,
        })),
        metricsHistory: metrics.slice(0, 50).map(m => ({
          timestamp: m.timestamp,
          netPnL: parseFloat(m.netPnl),
          totalReturn: parseFloat(m.totalReturn || "0"),
        })),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch agent details" });
    }
  });

  // Public API: Get market analysis data
  app.get("/api/v1/markets", async (req, res) => {
    try {
      const markets = await storage.getMarkets();
      const trades = await storage.getTrades(100);

      const marketData = markets.map(market => {
        const marketTrades = trades.filter(t => t.marketId === market.id);
        
        return {
          id: market.id,
          question: market.question,
          category: market.category,
          pricing: {
            yesPrice: parseFloat(market.yesPrice || "0"),
            noPrice: parseFloat(market.noPrice || "0"),
          },
          metrics: {
            volume: parseFloat(market.volume || "0"),
            liquidity: parseFloat(market.liquidity || "0"),
          },
          tradingActivity: {
            totalTrades: marketTrades.length,
            buyOrders: marketTrades.filter(t => t.action === "BUY").length,
            sellOrders: marketTrades.filter(t => t.action === "SELL").length,
          },
          status: market.status,
          endDate: market.endDate,
        };
      });

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        count: marketData.length,
        markets: marketData,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch markets" });
    }
  });

  // Public API: Get system status and configuration
  app.get("/api/v1/status", async (req, res) => {
    try {
      const lastCycle = await storage.getLastCycle();
      const agents = await storage.getAgents();
      const configuredProviders = getConfiguredProviders();

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        system: {
          version: "1.0.0",
          status: "operational",
          mode: process.env.POLYMARKET_PRIVATE_KEY ? "live" : "simulation",
        },
        scheduler: {
          isRunning: scheduler.isActive(),
          currentCycle: scheduler.getCurrentCycle(),
          intervalMinutes: config.trading.tickIntervalMinutes,
          lastCycle: lastCycle ? {
            number: lastCycle.cycleNumber,
            status: lastCycle.status,
            completedAt: lastCycle.completedAt,
          } : null,
        },
        agents: {
          total: agents.length,
          active: agents.filter(a => a.isActive).length,
          configuredProviders,
        },
        trading: {
          initialBalance: config.trading.initialBalance,
          maxTradePercent: config.trading.maxTradePercent * 100,
          maxDailyVolumePercent: config.trading.maxDailyVolumePercent * 100,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch status" });
    }
  });

  // Public API: Get performance history
  app.get("/api/v1/performance", async (req, res) => {
    try {
      const agents = await storage.getAgents();
      const limit = parseInt(req.query.limit as string) || 100;

      const performanceData = await Promise.all(
        agents.map(async (agent) => {
          const metrics = await storage.getMetricsByAgent(agent.id);
          
          return {
            agent: {
              id: agent.id,
              name: agent.name,
              model: agent.model,
              color: agent.color,
            },
            history: metrics.slice(0, limit).map(m => ({
              timestamp: m.timestamp,
              netPnL: parseFloat(m.netPnl),
              totalReturn: parseFloat(m.totalReturn || "0"),
              winRate: parseFloat(m.winRate?.toString() || "0"),
              sharpeRatio: parseFloat(m.sharpeRatio?.toString() || "0"),
              totalTrades: m.totalTrades,
            })),
          };
        })
      );

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        performance: performanceData,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch performance" });
    }
  });

  // Auto-start scheduler if configured
  if (config.system.autoStartScheduler) {
    logger.info("Auto-starting scheduler...", { source: "startup" });
    setTimeout(async () => {
      try {
        await scheduler.start();
        logger.info("Scheduler auto-started successfully", { source: "startup" });
      } catch (error) {
        logger.error(`Failed to auto-start scheduler: ${error}`, { 
          source: "startup",
          metadata: { error: String(error) },
        });
      }
    }, 5000); // Wait 5 seconds for server to be fully ready
  }

  return httpServer;
}
