import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// AI Agent model - represents each competing AI
export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  model: text("model").notNull(),
  provider: text("provider").notNull(),
  initialBalance: decimal("initial_balance", { precision: 18, scale: 2 }).notNull().default("500.00"),
  currentBalance: decimal("current_balance", { precision: 18, scale: 2 }).notNull().default("500.00"),
  strategyDescription: text("strategy_description").notNull(),
  color: text("color").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Market data from Polymarket
export const markets = pgTable("markets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  polymarketId: text("polymarket_id").notNull().unique(),
  question: text("question").notNull(),
  category: text("category").notNull(),
  endDate: timestamp("end_date"),
  volume: decimal("volume", { precision: 18, scale: 2 }).default("0"),
  liquidity: decimal("liquidity", { precision: 18, scale: 2 }).default("0"),
  yesPrice: decimal("yes_price", { precision: 10, scale: 4 }).default("0.5"),
  noPrice: decimal("no_price", { precision: 10, scale: 4 }).default("0.5"),
  isResolved: boolean("is_resolved").notNull().default(false),
  outcome: text("outcome"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Trade records - every buy/sell/hold action
export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  marketId: varchar("market_id").notNull().references(() => markets.id),
  action: text("action").notNull(), // BUY, SELL, HOLD
  side: text("side").notNull(), // YES, NO
  sizeUsd: decimal("size_usd", { precision: 18, scale: 2 }).notNull(),
  price: decimal("price", { precision: 10, scale: 4 }).notNull(),
  shares: decimal("shares", { precision: 18, scale: 6 }).default("0"),
  reasoning: text("reasoning").notNull(),
  executedAt: timestamp("executed_at").notNull().defaultNow(),
  status: text("status").notNull().default("pending"), // pending, executed, failed
  errorMessage: text("error_message"),
});

// Current positions held by each agent
export const positions = pgTable("positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  marketId: varchar("market_id").notNull().references(() => markets.id),
  side: text("side").notNull(), // YES, NO
  shares: decimal("shares", { precision: 18, scale: 6 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 10, scale: 4 }).notNull(),
  currentValue: decimal("current_value", { precision: 18, scale: 2 }).default("0"),
  unrealizedPnl: decimal("unrealized_pnl", { precision: 18, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Performance metrics snapshots
export const performanceMetrics = pgTable("performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  netPnl: decimal("net_pnl", { precision: 18, scale: 2 }).notNull().default("0"),
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 4 }).default("0"),
  maxDrawdown: decimal("max_drawdown", { precision: 10, scale: 4 }).default("0"),
  winRate: decimal("win_rate", { precision: 10, scale: 4 }).default("0"),
  totalTrades: integer("total_trades").notNull().default(0),
  winningTrades: integer("winning_trades").notNull().default(0),
  losingTrades: integer("losing_trades").notNull().default(0),
  avgHoldingTime: integer("avg_holding_time").default(0), // in minutes
  turnover: decimal("turnover", { precision: 18, scale: 2 }).default("0"),
});

// Market data snapshots for historical analysis
export const marketSnapshots = pgTable("market_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marketId: varchar("market_id").notNull().references(() => markets.id),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  yesPrice: decimal("yes_price", { precision: 10, scale: 4 }).notNull(),
  noPrice: decimal("no_price", { precision: 10, scale: 4 }).notNull(),
  volume: decimal("volume", { precision: 18, scale: 2 }).default("0"),
  sentimentScore: decimal("sentiment_score", { precision: 10, scale: 4 }).default("0"),
  newsCount: integer("news_count").default(0),
});

// System logs for debugging and monitoring
export const systemLogs = pgTable("system_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  level: text("level").notNull(), // info, warn, error, debug
  source: text("source").notNull(), // scheduler, agent, executor, data_collector
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Tick cycles - tracks each 15-minute execution cycle
export const tickCycles = pgTable("tick_cycles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cycleNumber: integer("cycle_number").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  status: text("status").notNull().default("running"), // running, completed, failed
  marketsProcessed: integer("markets_processed").default(0),
  tradesExecuted: integer("trades_executed").default(0),
  errorCount: integer("error_count").default(0),
});

// Alerts - tracks significant events and notifications
export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // large_win, large_loss, risk_breach, market_opportunity, system_error
  severity: text("severity").notNull().default("info"), // info, warning, critical
  title: text("title").notNull(),
  message: text("message").notNull(),
  agentId: varchar("agent_id").references(() => agents.id),
  tradeId: varchar("trade_id").references(() => trades.id),
  marketId: varchar("market_id").references(() => markets.id),
  metadata: jsonb("metadata"),
  isRead: boolean("is_read").notNull().default(false),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const agentsRelations = relations(agents, ({ many }) => ({
  trades: many(trades),
  positions: many(positions),
  performanceMetrics: many(performanceMetrics),
}));

export const marketsRelations = relations(markets, ({ many }) => ({
  trades: many(trades),
  positions: many(positions),
  snapshots: many(marketSnapshots),
}));

export const tradesRelations = relations(trades, ({ one }) => ({
  agent: one(agents, { fields: [trades.agentId], references: [agents.id] }),
  market: one(markets, { fields: [trades.marketId], references: [markets.id] }),
}));

export const positionsRelations = relations(positions, ({ one }) => ({
  agent: one(agents, { fields: [positions.agentId], references: [agents.id] }),
  market: one(markets, { fields: [positions.marketId], references: [markets.id] }),
}));

export const performanceMetricsRelations = relations(performanceMetrics, ({ one }) => ({
  agent: one(agents, { fields: [performanceMetrics.agentId], references: [agents.id] }),
}));

export const marketSnapshotsRelations = relations(marketSnapshots, ({ one }) => ({
  market: one(markets, { fields: [marketSnapshots.marketId], references: [markets.id] }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  agent: one(agents, { fields: [alerts.agentId], references: [agents.id] }),
  trade: one(trades, { fields: [alerts.tradeId], references: [trades.id] }),
  market: one(markets, { fields: [alerts.marketId], references: [markets.id] }),
}));

// Insert schemas
export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
});

export const insertMarketSchema = createInsertSchema(markets).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  executedAt: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPerformanceMetricsSchema = createInsertSchema(performanceMetrics).omit({
  id: true,
  timestamp: true,
});

export const insertMarketSnapshotSchema = createInsertSchema(marketSnapshots).omit({
  id: true,
  timestamp: true,
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({
  id: true,
  timestamp: true,
});

export const insertTickCycleSchema = createInsertSchema(tickCycles).omit({
  id: true,
  startedAt: true,
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  createdAt: true,
});

// Types
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

export type Market = typeof markets.$inferSelect;
export type InsertMarket = z.infer<typeof insertMarketSchema>;

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;

export type Position = typeof positions.$inferSelect;
export type InsertPosition = z.infer<typeof insertPositionSchema>;

export type PerformanceMetrics = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetrics = z.infer<typeof insertPerformanceMetricsSchema>;

export type MarketSnapshot = typeof marketSnapshots.$inferSelect;
export type InsertMarketSnapshot = z.infer<typeof insertMarketSnapshotSchema>;

export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;

export type TickCycle = typeof tickCycles.$inferSelect;
export type InsertTickCycle = z.infer<typeof insertTickCycleSchema>;

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

// Action types for AI decisions
export const tradeActionSchema = z.object({
  action: z.enum(["BUY", "SELL", "HOLD"]),
  market_id: z.string(),
  side: z.enum(["YES", "NO"]),
  size_usd: z.number().min(0).max(50), // Max 10% of 500 USDC
  max_price: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type TradeAction = z.infer<typeof tradeActionSchema>;

// Leaderboard entry type
export type LeaderboardEntry = {
  rank: number;
  agent: Agent;
  metrics: PerformanceMetrics | null;
  recentTrades: Trade[];
};
