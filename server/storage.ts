import { 
  agents, 
  markets, 
  trades, 
  positions, 
  performanceMetrics, 
  marketSnapshots, 
  systemLogs, 
  tickCycles,
  alerts,
  type Agent, 
  type InsertAgent,
  type Market,
  type InsertMarket,
  type Trade,
  type InsertTrade,
  type Position,
  type InsertPosition,
  type PerformanceMetrics,
  type InsertPerformanceMetrics,
  type MarketSnapshot,
  type InsertMarketSnapshot,
  type SystemLog,
  type InsertSystemLog,
  type TickCycle,
  type InsertTickCycle,
  type Alert,
  type InsertAlert
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql } from "drizzle-orm";

export interface IStorage {
  // Agents
  getAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgentBalance(id: string, balance: string): Promise<Agent | undefined>;

  // Markets
  getMarkets(): Promise<Market[]>;
  getMarket(id: string): Promise<Market | undefined>;
  getMarketByPolymarketId(polymarketId: string): Promise<Market | undefined>;
  createMarket(market: InsertMarket): Promise<Market>;
  updateMarket(id: string, market: Partial<InsertMarket>): Promise<Market | undefined>;

  // Trades
  getTrades(limit?: number): Promise<Trade[]>;
  getTradesByAgent(agentId: string): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTradeStatus(id: string, status: string, errorMessage?: string): Promise<Trade | undefined>;

  // Positions
  getPositions(): Promise<Position[]>;
  getPositionsByAgent(agentId: string): Promise<Position[]>;
  getPosition(agentId: string, marketId: string, side: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePosition(id: string, position: Partial<InsertPosition>): Promise<Position | undefined>;
  deletePosition(id: string): Promise<void>;

  // Performance Metrics
  getLatestMetrics(): Promise<PerformanceMetrics[]>;
  getMetricsByAgent(agentId: string): Promise<PerformanceMetrics[]>;
  createMetrics(metrics: InsertPerformanceMetrics): Promise<PerformanceMetrics>;

  // Market Snapshots
  getMarketSnapshots(marketId: string): Promise<MarketSnapshot[]>;
  createMarketSnapshot(snapshot: InsertMarketSnapshot): Promise<MarketSnapshot>;

  // System Logs
  getLogs(limit?: number): Promise<SystemLog[]>;
  createLog(log: InsertSystemLog): Promise<SystemLog>;

  // Tick Cycles
  getLastCycle(): Promise<TickCycle | undefined>;
  createCycle(cycle: InsertTickCycle): Promise<TickCycle>;
  updateCycle(id: string, cycle: Partial<InsertTickCycle>): Promise<TickCycle | undefined>;

  // Alerts
  getAlerts(limit?: number): Promise<Alert[]>;
  getUnreadAlerts(): Promise<Alert[]>;
  getAlertsByAgent(agentId: string): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  markAlertRead(id: string): Promise<Alert | undefined>;
  markAlertDismissed(id: string): Promise<Alert | undefined>;
  markAllAlertsRead(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Agents
  async getAgents(): Promise<Agent[]> {
    return db.select().from(agents).orderBy(agents.name);
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent || undefined;
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [created] = await db.insert(agents).values(agent).returning();
    return created;
  }

  async updateAgentBalance(id: string, balance: string): Promise<Agent | undefined> {
    const [updated] = await db
      .update(agents)
      .set({ currentBalance: balance })
      .where(eq(agents.id, id))
      .returning();
    return updated || undefined;
  }

  // Markets
  async getMarkets(): Promise<Market[]> {
    return db.select().from(markets).orderBy(desc(markets.volume));
  }

  async getMarket(id: string): Promise<Market | undefined> {
    const [market] = await db.select().from(markets).where(eq(markets.id, id));
    return market || undefined;
  }

  async getMarketByPolymarketId(polymarketId: string): Promise<Market | undefined> {
    const [market] = await db
      .select()
      .from(markets)
      .where(eq(markets.polymarketId, polymarketId));
    return market || undefined;
  }

  async createMarket(market: InsertMarket): Promise<Market> {
    const [created] = await db.insert(markets).values(market).returning();
    return created;
  }

  async updateMarket(id: string, market: Partial<InsertMarket>): Promise<Market | undefined> {
    const [updated] = await db
      .update(markets)
      .set({ ...market, lastUpdated: new Date() })
      .where(eq(markets.id, id))
      .returning();
    return updated || undefined;
  }

  // Trades
  async getTrades(limit = 100): Promise<Trade[]> {
    return db
      .select()
      .from(trades)
      .orderBy(desc(trades.executedAt))
      .limit(limit);
  }

  async getTradesByAgent(agentId: string): Promise<Trade[]> {
    return db
      .select()
      .from(trades)
      .where(eq(trades.agentId, agentId))
      .orderBy(desc(trades.executedAt));
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [created] = await db.insert(trades).values(trade).returning();
    return created;
  }

  async updateTradeStatus(
    id: string, 
    status: string, 
    errorMessage?: string
  ): Promise<Trade | undefined> {
    const [updated] = await db
      .update(trades)
      .set({ status, errorMessage })
      .where(eq(trades.id, id))
      .returning();
    return updated || undefined;
  }

  // Positions
  async getPositions(): Promise<Position[]> {
    return db.select().from(positions);
  }

  async getPositionsByAgent(agentId: string): Promise<Position[]> {
    return db
      .select()
      .from(positions)
      .where(eq(positions.agentId, agentId));
  }

  async getPosition(
    agentId: string, 
    marketId: string, 
    side: string
  ): Promise<Position | undefined> {
    const [position] = await db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.agentId, agentId),
          eq(positions.marketId, marketId),
          eq(positions.side, side)
        )
      );
    return position || undefined;
  }

  async createPosition(position: InsertPosition): Promise<Position> {
    const [created] = await db.insert(positions).values(position).returning();
    return created;
  }

  async updatePosition(
    id: string, 
    position: Partial<InsertPosition>
  ): Promise<Position | undefined> {
    const [updated] = await db
      .update(positions)
      .set({ ...position, updatedAt: new Date() })
      .where(eq(positions.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePosition(id: string): Promise<void> {
    await db.delete(positions).where(eq(positions.id, id));
  }

  // Performance Metrics
  async getLatestMetrics(): Promise<PerformanceMetrics[]> {
    const agentsList = await this.getAgents();
    const latestMetrics: PerformanceMetrics[] = [];

    for (const agent of agentsList) {
      const [latest] = await db
        .select()
        .from(performanceMetrics)
        .where(eq(performanceMetrics.agentId, agent.id))
        .orderBy(desc(performanceMetrics.timestamp))
        .limit(1);
      
      if (latest) {
        latestMetrics.push(latest);
      }
    }

    return latestMetrics;
  }

  async getMetricsByAgent(agentId: string): Promise<PerformanceMetrics[]> {
    return db
      .select()
      .from(performanceMetrics)
      .where(eq(performanceMetrics.agentId, agentId))
      .orderBy(desc(performanceMetrics.timestamp));
  }

  async createMetrics(metrics: InsertPerformanceMetrics): Promise<PerformanceMetrics> {
    const [created] = await db
      .insert(performanceMetrics)
      .values(metrics)
      .returning();
    return created;
  }

  // Market Snapshots
  async getMarketSnapshots(marketId: string): Promise<MarketSnapshot[]> {
    return db
      .select()
      .from(marketSnapshots)
      .where(eq(marketSnapshots.marketId, marketId))
      .orderBy(desc(marketSnapshots.timestamp));
  }

  async createMarketSnapshot(snapshot: InsertMarketSnapshot): Promise<MarketSnapshot> {
    const [created] = await db
      .insert(marketSnapshots)
      .values(snapshot)
      .returning();
    return created;
  }

  // System Logs
  async getLogs(limit = 50): Promise<SystemLog[]> {
    return db
      .select()
      .from(systemLogs)
      .orderBy(desc(systemLogs.timestamp))
      .limit(limit);
  }

  async createLog(log: InsertSystemLog): Promise<SystemLog> {
    const [created] = await db.insert(systemLogs).values(log).returning();
    return created;
  }

  // Tick Cycles
  async getLastCycle(): Promise<TickCycle | undefined> {
    const [cycle] = await db
      .select()
      .from(tickCycles)
      .orderBy(desc(tickCycles.cycleNumber))
      .limit(1);
    return cycle || undefined;
  }

  async createCycle(cycle: InsertTickCycle): Promise<TickCycle> {
    const [created] = await db.insert(tickCycles).values(cycle).returning();
    return created;
  }

  async updateCycle(
    id: string, 
    cycle: Partial<InsertTickCycle>
  ): Promise<TickCycle | undefined> {
    const [updated] = await db
      .update(tickCycles)
      .set(cycle)
      .where(eq(tickCycles.id, id))
      .returning();
    return updated || undefined;
  }

  // Alerts
  async getAlerts(limit = 50): Promise<Alert[]> {
    return db
      .select()
      .from(alerts)
      .where(eq(alerts.isDismissed, false))
      .orderBy(desc(alerts.createdAt))
      .limit(limit);
  }

  async getUnreadAlerts(): Promise<Alert[]> {
    return db
      .select()
      .from(alerts)
      .where(and(eq(alerts.isRead, false), eq(alerts.isDismissed, false)))
      .orderBy(desc(alerts.createdAt));
  }

  async getAlertsByAgent(agentId: string): Promise<Alert[]> {
    return db
      .select()
      .from(alerts)
      .where(and(eq(alerts.agentId, agentId), eq(alerts.isDismissed, false)))
      .orderBy(desc(alerts.createdAt));
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [created] = await db.insert(alerts).values(alert).returning();
    return created;
  }

  async markAlertRead(id: string): Promise<Alert | undefined> {
    const [updated] = await db
      .update(alerts)
      .set({ isRead: true })
      .where(eq(alerts.id, id))
      .returning();
    return updated || undefined;
  }

  async markAlertDismissed(id: string): Promise<Alert | undefined> {
    const [updated] = await db
      .update(alerts)
      .set({ isDismissed: true })
      .where(eq(alerts.id, id))
      .returning();
    return updated || undefined;
  }

  async markAllAlertsRead(): Promise<void> {
    await db
      .update(alerts)
      .set({ isRead: true })
      .where(eq(alerts.isRead, false));
  }
}

export const storage = new DatabaseStorage();
