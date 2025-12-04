import { config } from "../config";
import { storage } from "../storage";
import { logger } from "./logger";
import { dataCollector } from "./data-collector";
import { aiAgentService } from "./ai-agents";
import { tradeExecutor } from "./trade-executor";
import { websocketService } from "./websocket";

// Scheduler service - manages the 15-minute trading cycles

export class Scheduler {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private cycleNumber: number = 0;

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Scheduler already running", { source: "scheduler" });
      return;
    }

    this.isRunning = true;

    // Get last cycle number
    const lastCycle = await storage.getLastCycle();
    this.cycleNumber = lastCycle ? lastCycle.cycleNumber : 0;

    logger.info("Scheduler starting", { 
      source: "scheduler",
      metadata: { 
        intervalMinutes: config.trading.tickIntervalMinutes,
        lastCycle: this.cycleNumber,
      },
    });

    // Initialize agents
    await aiAgentService.initializeAgents();

    // Run first cycle immediately
    await this.runCycle();

    // Schedule subsequent cycles
    const intervalMs = config.trading.tickIntervalMinutes * 60 * 1000;
    this.intervalId = setInterval(() => this.runCycle(), intervalMs);

    logger.info(`Scheduler started - next cycle in ${config.trading.tickIntervalMinutes} minutes`, { 
      source: "scheduler" 
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info("Scheduler stopped", { source: "scheduler" });
  }

  async runCycle(): Promise<void> {
    this.cycleNumber++;

    logger.info(`Starting trading cycle #${this.cycleNumber}`, { 
      source: "scheduler",
      metadata: { cycleNumber: this.cycleNumber },
    });

    // Create cycle record
    const cycle = await storage.createCycle({
      cycleNumber: this.cycleNumber,
      status: "running",
      marketsProcessed: 0,
      tradesExecuted: 0,
      errorCount: 0,
    });

    // Broadcast cycle start
    websocketService.broadcastCycleStart(cycle);

    let marketsProcessed = 0;
    let tradesExecuted = 0;
    let errorCount = 0;

    try {
      // Step 1: Collect data
      logger.info("Collecting market data...", { source: "scheduler" });
      const data = await dataCollector.collectAll();
      marketsProcessed = data.markets.length;

      // Step 2: Format data for agents
      const marketIntelligence = dataCollector.formatForAgents(data);

      // Step 3: Get AI agent decisions
      logger.info("Getting AI agent decisions...", { source: "scheduler" });
      const decisions = await aiAgentService.getDecisions(marketIntelligence);

      // Step 4: Execute trades
      logger.info("Executing trades...", { source: "scheduler" });
      
      for (const decision of decisions) {
        if (decision.error) {
          errorCount++;
          continue;
        }

        if (!decision.tradeAction || decision.tradeAction.action === "HOLD") {
          continue;
        }

        const result = await tradeExecutor.executeTrade(
          decision.agentId,
          decision.tradeAction
        );

        if (result.success) {
          tradesExecuted++;
          // Broadcast new trade
          const agent = await storage.getAgent(decision.agentId);
          if (agent && result.trade) {
            websocketService.broadcastNewTrade(result.trade, agent);
          }
        } else {
          errorCount++;
        }
      }

      // Step 5: Update position values
      await tradeExecutor.updatePositionValues();

      // Update cycle record
      await storage.updateCycle(cycle.id, {
        status: "completed",
        completedAt: new Date(),
        marketsProcessed,
        tradesExecuted,
        errorCount,
      });

      logger.info(`Cycle #${this.cycleNumber} completed`, {
        source: "scheduler",
        metadata: {
          cycleNumber: this.cycleNumber,
          marketsProcessed,
          tradesExecuted,
          errorCount,
        },
      });

      // Broadcast cycle completion with updated data
      const [agents, metrics] = await Promise.all([
        storage.getAgents(),
        storage.getLatestMetrics(),
      ]);
      
      const completedCycle = await storage.getLastCycle();
      if (completedCycle) {
        websocketService.broadcastCycleComplete(completedCycle, {
          tradesExecuted,
          marketsProcessed,
          agents,
          metrics,
        });
      }

    } catch (error) {
      logger.error(`Cycle #${this.cycleNumber} failed: ${error}`, {
        source: "scheduler",
        metadata: { cycleNumber: this.cycleNumber, error: String(error) },
      });

      await storage.updateCycle(cycle.id, {
        status: "failed",
        completedAt: new Date(),
        marketsProcessed,
        tradesExecuted,
        errorCount: errorCount + 1,
      });
    }
  }

  // Manual trigger for testing
  async triggerCycle(): Promise<void> {
    if (!this.isRunning) {
      await this.start();
    } else {
      await this.runCycle();
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getCurrentCycle(): number {
    return this.cycleNumber;
  }
}

export const scheduler = new Scheduler();
