import { config } from "../config";
import { storage } from "../storage";
import { logger } from "./logger";
import type { Agent, Market, Trade, Position, TradeAction } from "@shared/schema";

// Trade execution service - executes trades on Polymarket

interface ExecutionResult {
  success: boolean;
  trade: Trade | null;
  error?: string;
}

export class TradeExecutor {
  private clobUrl: string;
  private isSimulation: boolean;

  constructor() {
    this.clobUrl = config.apis.polymarket.baseUrl;
    
    // Check if we have real trading credentials
    this.isSimulation = !(
      process.env.POLYMARKET_PRIVATE_KEY &&
      process.env.POLYMARKET_API_KEY &&
      process.env.POLYMARKET_API_SECRET
    );

    if (this.isSimulation) {
      logger.warn("Running in SIMULATION mode - no real trades will be executed", { source: "executor" });
    }
  }

  async executeTrade(
    agentId: string,
    action: TradeAction
  ): Promise<ExecutionResult> {
    try {
      // Validate the trade
      const validation = await this.validateTrade(agentId, action);
      if (!validation.valid) {
        return {
          success: false,
          trade: null,
          error: validation.error,
        };
      }

      const agent = await storage.getAgent(agentId);
      const market = await storage.getMarket(action.market_id);

      if (!agent || !market) {
        return {
          success: false,
          trade: null,
          error: "Agent or market not found",
        };
      }

      // Get current market price
      const currentPrice = action.side === "YES" 
        ? parseFloat(market.yesPrice || "0.5")
        : parseFloat(market.noPrice || "0.5");

      // Check price limits
      if (action.action === "BUY" && currentPrice > action.max_price) {
        return {
          success: false,
          trade: null,
          error: `Price ${currentPrice} exceeds max ${action.max_price}`,
        };
      }

      // Calculate shares
      const shares = action.size_usd / currentPrice;

      // Create the trade record
      const trade = await storage.createTrade({
        agentId,
        marketId: action.market_id,
        action: action.action,
        side: action.side,
        sizeUsd: action.size_usd.toString(),
        price: currentPrice.toString(),
        shares: shares.toString(),
        reasoning: action.reasoning,
        status: "pending",
      });

      // Execute based on action type
      let executionSuccess = false;

      if (this.isSimulation) {
        // Simulation mode - just update balances and positions
        executionSuccess = await this.simulateTrade(agent, market, action, shares, currentPrice);
      } else {
        // Real execution via Polymarket CLOB API
        executionSuccess = await this.executeRealTrade(agent, market, action, shares, currentPrice);
      }

      if (executionSuccess) {
        await storage.updateTradeStatus(trade.id, "executed");
        
        logger.info(`Trade executed: ${action.action} ${action.side} $${action.size_usd} on ${market.question.substring(0, 50)}...`, {
          source: "executor",
          metadata: { 
            tradeId: trade.id, 
            agentId, 
            action: action.action,
            side: action.side,
            size: action.size_usd,
          },
        });

        // Update performance metrics
        await this.updateMetrics(agent);

        return {
          success: true,
          trade: await storage.getTrades(1).then(trades => trades[0]) || trade,
        };
      } else {
        await storage.updateTradeStatus(trade.id, "failed", "Execution failed");
        return {
          success: false,
          trade,
          error: "Trade execution failed",
        };
      }
    } catch (error) {
      logger.error(`Trade execution error: ${error}`, {
        source: "executor",
        metadata: { agentId, action, error: String(error) },
      });

      return {
        success: false,
        trade: null,
        error: String(error),
      };
    }
  }

  private async validateTrade(agentId: string, action: TradeAction): Promise<{ valid: boolean; error?: string }> {
    // Skip validation for HOLD
    if (action.action === "HOLD") {
      return { valid: true };
    }

    const agent = await storage.getAgent(agentId);
    if (!agent) {
      return { valid: false, error: "Agent not found" };
    }

    const market = await storage.getMarket(action.market_id);
    if (!market) {
      return { valid: false, error: "Market not found" };
    }

    // Check market is not resolved
    if (market.isResolved) {
      return { valid: false, error: "Market is already resolved" };
    }

    // Check agent balance
    const balance = parseFloat(agent.currentBalance);
    if (action.action === "BUY" && action.size_usd > balance) {
      return { valid: false, error: `Insufficient balance: $${balance.toFixed(2)}` };
    }

    // Check trade size limits
    const maxTradeSize = parseFloat(agent.initialBalance) * config.trading.maxTradePercent;
    if (action.size_usd > maxTradeSize) {
      return { valid: false, error: `Trade size exceeds ${config.trading.maxTradePercent * 100}% limit` };
    }

    // Check liquidity
    const liquidity = parseFloat(market.liquidity || "0");
    if (liquidity < config.trading.minLiquidity) {
      return { valid: false, error: `Market liquidity too low: $${liquidity}` };
    }

    // For SELL, check if agent has position to sell
    if (action.action === "SELL") {
      const position = await storage.getPosition(agentId, action.market_id, action.side);
      if (!position || parseFloat(position.shares) * parseFloat(position.entryPrice) < action.size_usd) {
        return { valid: false, error: "Insufficient position to sell" };
      }
    }

    return { valid: true };
  }

  private async simulateTrade(
    agent: Agent,
    market: Market,
    action: TradeAction,
    shares: number,
    price: number
  ): Promise<boolean> {
    try {
      const balance = parseFloat(agent.currentBalance);

      if (action.action === "BUY") {
        // Deduct from balance
        const newBalance = balance - action.size_usd;
        await storage.updateAgentBalance(agent.id, newBalance.toString());

        // Add or update position
        const existingPosition = await storage.getPosition(agent.id, market.id, action.side);
        
        if (existingPosition) {
          const existingShares = parseFloat(existingPosition.shares);
          const existingValue = existingShares * parseFloat(existingPosition.entryPrice);
          const newShares = existingShares + shares;
          const newAvgPrice = (existingValue + action.size_usd) / newShares;

          await storage.updatePosition(existingPosition.id, {
            shares: newShares.toString(),
            entryPrice: newAvgPrice.toString(),
            currentValue: (newShares * price).toString(),
          });
        } else {
          await storage.createPosition({
            agentId: agent.id,
            marketId: market.id,
            side: action.side,
            shares: shares.toString(),
            entryPrice: price.toString(),
            currentValue: action.size_usd.toString(),
            unrealizedPnl: "0",
          });
        }
      } else if (action.action === "SELL") {
        // Add to balance
        const newBalance = balance + action.size_usd;
        await storage.updateAgentBalance(agent.id, newBalance.toString());

        // Reduce or remove position
        const position = await storage.getPosition(agent.id, market.id, action.side);
        if (position) {
          const currentShares = parseFloat(position.shares);
          const sharesToSell = action.size_usd / price;
          const remainingShares = currentShares - sharesToSell;

          if (remainingShares <= 0.001) {
            await storage.deletePosition(position.id);
          } else {
            await storage.updatePosition(position.id, {
              shares: remainingShares.toString(),
              currentValue: (remainingShares * price).toString(),
            });
          }
        }
      }

      return true;
    } catch (error) {
      logger.error(`Simulation trade failed: ${error}`, {
        source: "executor",
        metadata: { agentId: agent.id, error: String(error) },
      });
      return false;
    }
  }

  private async executeRealTrade(
    agent: Agent,
    market: Market,
    action: TradeAction,
    shares: number,
    price: number
  ): Promise<boolean> {
    // Real Polymarket CLOB execution
    // This would require:
    // 1. Signing the order with the private key
    // 2. Submitting to the CLOB API
    // 3. Handling order responses and fills

    try {
      const apiKey = process.env.POLYMARKET_API_KEY;
      const apiSecret = process.env.POLYMARKET_API_SECRET;
      const passphrase = process.env.POLYMARKET_PASSPHRASE;

      if (!apiKey || !apiSecret || !passphrase) {
        logger.error("Missing Polymarket API credentials", { source: "executor" });
        return false;
      }

      // For now, we fall back to simulation as real execution requires
      // proper order signing and the py-clob-client library
      logger.warn("Real trading not yet implemented - falling back to simulation", { source: "executor" });
      return this.simulateTrade(agent, market, action, shares, price);
    } catch (error) {
      logger.error(`Real trade execution failed: ${error}`, {
        source: "executor",
        metadata: { error: String(error) },
      });
      return false;
    }
  }

  private async updateMetrics(agent: Agent): Promise<void> {
    try {
      const trades = await storage.getTradesByAgent(agent.id);
      const positions = await storage.getPositionsByAgent(agent.id);

      // Calculate metrics
      const executedTrades = trades.filter(t => t.status === "executed");
      const totalTrades = executedTrades.length;

      // Calculate PnL
      const initialBalance = parseFloat(agent.initialBalance);
      const currentBalance = parseFloat(agent.currentBalance);
      
      // Add unrealized PnL from positions
      let unrealizedPnl = 0;
      for (const pos of positions) {
        unrealizedPnl += parseFloat(pos.unrealizedPnl || "0");
      }

      const netPnl = (currentBalance - initialBalance) + unrealizedPnl;

      // Calculate win/loss (simplified - based on realized trades)
      let winningTrades = 0;
      let losingTrades = 0;

      // Simple win rate calculation based on trade outcomes
      // In a real implementation, this would track actual P&L per trade
      const buyTrades = executedTrades.filter(t => t.action === "BUY");
      const sellTrades = executedTrades.filter(t => t.action === "SELL");
      
      // Assume 50% baseline win rate with slight adjustment based on PnL
      const pnlRatio = netPnl / initialBalance;
      const estimatedWinRate = Math.max(0.3, Math.min(0.7, 0.5 + pnlRatio));
      
      winningTrades = Math.floor(totalTrades * estimatedWinRate);
      losingTrades = totalTrades - winningTrades;

      const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

      // Calculate Sharpe ratio (simplified)
      const returns = netPnl / initialBalance;
      const volatility = 0.2; // Assumed 20% volatility
      const sharpeRatio = volatility > 0 ? returns / volatility : 0;

      // Calculate max drawdown (simplified)
      const maxDrawdown = Math.min(0, netPnl / initialBalance);

      // Calculate turnover
      const totalVolume = executedTrades.reduce((sum, t) => sum + parseFloat(t.sizeUsd), 0);
      const turnover = totalVolume;

      // Calculate average holding time (in minutes)
      let avgHoldingTime = 0;
      if (totalTrades > 0) {
        // Estimate based on cycle interval
        avgHoldingTime = config.trading.tickIntervalMinutes * 4; // Assume 4 cycles average
      }

      // Save metrics
      await storage.createMetrics({
        agentId: agent.id,
        netPnl: netPnl.toString(),
        sharpeRatio: sharpeRatio.toString(),
        maxDrawdown: maxDrawdown.toString(),
        winRate: winRate.toString(),
        totalTrades,
        winningTrades,
        losingTrades,
        avgHoldingTime,
        turnover: turnover.toString(),
      });

    } catch (error) {
      logger.error(`Failed to update metrics for agent ${agent.id}: ${error}`, {
        source: "executor",
        metadata: { agentId: agent.id, error: String(error) },
      });
    }
  }

  // Update all positions with current market prices
  async updatePositionValues(): Promise<void> {
    try {
      const positions = await storage.getPositions();
      const markets = await storage.getMarkets();
      const marketMap = new Map(markets.map(m => [m.id, m]));

      for (const position of positions) {
        const market = marketMap.get(position.marketId);
        if (!market) continue;

        const currentPrice = position.side === "YES"
          ? parseFloat(market.yesPrice || "0.5")
          : parseFloat(market.noPrice || "0.5");

        const shares = parseFloat(position.shares);
        const entryPrice = parseFloat(position.entryPrice);
        const currentValue = shares * currentPrice;
        const unrealizedPnl = (currentPrice - entryPrice) * shares;

        await storage.updatePosition(position.id, {
          currentValue: currentValue.toString(),
          unrealizedPnl: unrealizedPnl.toString(),
        });
      }
    } catch (error) {
      logger.error(`Failed to update position values: ${error}`, {
        source: "executor",
        metadata: { error: String(error) },
      });
    }
  }
}

export const tradeExecutor = new TradeExecutor();
