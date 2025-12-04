import { storage } from "../storage";
import { logger } from "./logger";
import { websocketService } from "./websocket";
import { config } from "../config";
import type { Trade, Agent, PerformanceMetrics, InsertAlert } from "@shared/schema";

interface AlertThresholds {
  largeWinAmount: number;
  largeLossAmount: number;
  riskLimitPercent: number;
  significantDrawdown: number;
  highWinRateThreshold: number;
}

const defaultThresholds: AlertThresholds = {
  largeWinAmount: 25,
  largeLossAmount: 20,
  riskLimitPercent: 35,
  significantDrawdown: 10,
  highWinRateThreshold: 75,
};

class AlertService {
  private thresholds: AlertThresholds;

  constructor() {
    this.thresholds = defaultThresholds;
  }

  async checkTradeAlerts(trade: Trade, agent: Agent): Promise<void> {
    const tradeSize = parseFloat(trade.sizeUsd);
    const portfolioSize = parseFloat(agent.currentBalance);
    const tradePercent = (tradeSize / portfolioSize) * 100;

    if (trade.action === "BUY" && trade.status === "executed") {
      const estimatedGain = tradeSize * 0.1;
      
      if (estimatedGain >= this.thresholds.largeWinAmount) {
        await this.createAlert({
          type: "large_win",
          severity: "info",
          title: `Large Position: ${agent.name}`,
          message: `${agent.name} opened a significant position of $${tradeSize.toFixed(2)} (${tradePercent.toFixed(1)}% of portfolio)`,
          agentId: agent.id,
          tradeId: trade.id,
          marketId: trade.marketId,
          metadata: { tradeSize, tradePercent, estimatedGain },
        });
      }
    }

    if (tradePercent >= this.thresholds.riskLimitPercent) {
      await this.createAlert({
        type: "risk_breach",
        severity: "warning",
        title: `Risk Limit Warning: ${agent.name}`,
        message: `Trade size ${tradePercent.toFixed(1)}% approaches the 40% daily limit`,
        agentId: agent.id,
        tradeId: trade.id,
        metadata: { tradePercent, limit: config.trading.maxDailyVolumePercent * 100 },
      });
    }

    if (trade.status === "failed" && trade.errorMessage) {
      await this.createAlert({
        type: "system_error",
        severity: "warning",
        title: `Trade Failed: ${agent.name}`,
        message: trade.errorMessage,
        agentId: agent.id,
        tradeId: trade.id,
        metadata: { errorMessage: trade.errorMessage },
      });
    }
  }

  async checkPerformanceAlerts(
    agent: Agent,
    metrics: PerformanceMetrics,
    previousMetrics?: PerformanceMetrics
  ): Promise<void> {
    const netPnL = parseFloat(metrics.netPnl);
    const maxDrawdown = parseFloat(metrics.maxDrawdown?.toString() || "0");
    const winRate = parseFloat(metrics.winRate?.toString() || "0");

    if (previousMetrics) {
      const previousPnL = parseFloat(previousMetrics.netPnl);
      const pnlChange = netPnL - previousPnL;

      if (pnlChange >= this.thresholds.largeWinAmount) {
        await this.createAlert({
          type: "large_win",
          severity: "info",
          title: `Winning Streak: ${agent.name}`,
          message: `${agent.name} gained $${pnlChange.toFixed(2)} in the last cycle`,
          agentId: agent.id,
          metadata: { pnlChange, totalPnL: netPnL },
        });
      }

      if (pnlChange <= -this.thresholds.largeLossAmount) {
        await this.createAlert({
          type: "large_loss",
          severity: "warning",
          title: `Significant Loss: ${agent.name}`,
          message: `${agent.name} lost $${Math.abs(pnlChange).toFixed(2)} in the last cycle`,
          agentId: agent.id,
          metadata: { pnlChange, totalPnL: netPnL },
        });
      }
    }

    if (maxDrawdown >= this.thresholds.significantDrawdown) {
      await this.createAlert({
        type: "risk_breach",
        severity: "critical",
        title: `Drawdown Alert: ${agent.name}`,
        message: `${agent.name} has reached ${maxDrawdown.toFixed(1)}% maximum drawdown`,
        agentId: agent.id,
        metadata: { maxDrawdown, netPnL },
      });
    }

    if (winRate >= this.thresholds.highWinRateThreshold && metrics.totalTrades >= 5) {
      await this.createAlert({
        type: "market_opportunity",
        severity: "info",
        title: `High Win Rate: ${agent.name}`,
        message: `${agent.name} is achieving ${winRate.toFixed(0)}% win rate over ${metrics.totalTrades} trades`,
        agentId: agent.id,
        metadata: { winRate, totalTrades: metrics.totalTrades },
      });
    }
  }

  async checkCycleAlerts(cycleStats: {
    cycleNumber: number;
    marketsProcessed: number;
    tradesExecuted: number;
    errorCount: number;
  }): Promise<void> {
    if (cycleStats.errorCount > 0) {
      await this.createAlert({
        type: "system_error",
        severity: cycleStats.errorCount >= 3 ? "critical" : "warning",
        title: `Cycle #${cycleStats.cycleNumber} Errors`,
        message: `${cycleStats.errorCount} errors occurred during trading cycle`,
        metadata: cycleStats,
      });
    }

    if (cycleStats.tradesExecuted >= 3) {
      await this.createAlert({
        type: "market_opportunity",
        severity: "info",
        title: `Active Trading Cycle`,
        message: `Cycle #${cycleStats.cycleNumber}: ${cycleStats.tradesExecuted} trades executed across ${cycleStats.marketsProcessed} markets`,
        metadata: cycleStats,
      });
    }
  }

  async createAlert(alertData: InsertAlert): Promise<void> {
    try {
      const alert = await storage.createAlert(alertData);
      
      logger.info(`Alert created: ${alertData.title}`, {
        source: "alerts",
        metadata: { alertId: alert.id, type: alertData.type },
      });

      websocketService.broadcastAlert({
        type: alertData.type,
        severity: alertData.severity as "info" | "warning" | "critical",
        title: alertData.title,
        message: alertData.message,
        agentId: alertData.agentId || undefined,
        tradeId: alertData.tradeId || undefined,
        metadata: alertData.metadata as Record<string, unknown> | undefined,
      });
    } catch (error) {
      logger.error(`Failed to create alert: ${error}`, {
        source: "alerts",
        metadata: { alertData, error: String(error) },
      });
    }
  }

  async getRecentAlerts(limit = 20) {
    return storage.getAlerts(limit);
  }

  async getUnreadCount(): Promise<number> {
    const unread = await storage.getUnreadAlerts();
    return unread.length;
  }
}

export const alertService = new AlertService();
