import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { config } from "../config";
import { storage } from "../storage";
import { logger } from "./logger";
import type { Agent, TradeAction } from "@shared/schema";

// AI Agent service - manages all 4 AI trading agents

const AGENT_SYSTEM_PROMPT = `You are a professional trading agent competing in prediction markets. Your goal is to maximize returns while managing risk.

RULES:
1. You can execute ONE action per market: BUY, SELL, or HOLD
2. Maximum trade size: $50 USDC (10% of $500 portfolio)
3. Always provide clear reasoning for your decision
4. Consider market liquidity, sentiment, and timing
5. Be conservative with position sizing in uncertain markets

RESPONSE FORMAT (JSON only, no markdown):
{
  "action": "BUY" | "SELL" | "HOLD",
  "market_id": "string (from the market data)",
  "side": "YES" | "NO",
  "size_usd": number (0-50),
  "max_price": number (0-1),
  "reasoning": "string explaining your decision"
}

If you choose HOLD, set size_usd to 0.`;

interface AgentDecision {
  agentId: string;
  agentName: string;
  tradeAction: TradeAction | null;
  error?: string;
}

export class AIAgentService {
  private openaiClient: OpenAI | null = null;
  private xaiClient: OpenAI | null = null;
  private anthropicClient: Anthropic | null = null;
  private geminiClient: GoogleGenAI | null = null;

  constructor() {
    // Initialize clients based on available API keys
    if (process.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    if (process.env.XAI_API_KEY) {
      this.xaiClient = new OpenAI({ 
        baseURL: "https://api.x.ai/v1", 
        apiKey: process.env.XAI_API_KEY 
      });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropicClient = new Anthropic({ 
        apiKey: process.env.ANTHROPIC_API_KEY 
      });
    }

    if (process.env.GEMINI_API_KEY) {
      this.geminiClient = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY 
      });
    }
  }

  async initializeAgents(): Promise<Agent[]> {
    const agentConfigs = Object.values(config.models);
    const agents: Agent[] = [];

    for (const cfg of agentConfigs) {
      // Check if agent already exists
      const existingAgents = await storage.getAgents();
      let agent = existingAgents.find((a) => a.name === cfg.name);

      if (!agent) {
        agent = await storage.createAgent({
          name: cfg.name,
          model: cfg.model,
          provider: cfg.provider,
          initialBalance: config.trading.initialBalance.toString(),
          currentBalance: config.trading.initialBalance.toString(),
          strategyDescription: cfg.strategy,
          color: cfg.color,
          isActive: true,
        });
        
        logger.info(`Created agent: ${agent.name}`, { 
          source: "agent",
          metadata: { agentId: agent.id, model: agent.model },
        });
      }

      agents.push(agent);
    }

    return agents;
  }

  async getDecisions(marketData: string): Promise<AgentDecision[]> {
    const agents = await storage.getAgents();
    const decisions: AgentDecision[] = [];

    for (const agent of agents) {
      if (!agent.isActive) continue;

      try {
        const decision = await this.getAgentDecision(agent, marketData);
        decisions.push(decision);
      } catch (error) {
        logger.error(`Agent ${agent.name} decision failed: ${error}`, {
          source: "agent",
          metadata: { agentId: agent.id, error: String(error) },
        });
        
        decisions.push({
          agentId: agent.id,
          agentName: agent.name,
          tradeAction: null,
          error: String(error),
        });
      }
    }

    return decisions;
  }

  private async getAgentDecision(agent: Agent, marketData: string): Promise<AgentDecision> {
    const balance = parseFloat(agent.currentBalance);
    const positions = await storage.getPositionsByAgent(agent.id);

    const userPrompt = `Your current portfolio:
- Balance: $${balance.toFixed(2)} USDC
- Open positions: ${positions.length}

Your trading strategy: ${agent.strategyDescription}

${marketData}

Analyze the markets above and provide your trading decision. Choose the best opportunity that matches your strategy.`;

    let tradeAction: TradeAction | null = null;

    switch (agent.provider) {
      case "openai":
        tradeAction = await this.callOpenAI(userPrompt);
        break;
      case "xai":
        tradeAction = await this.callXAI(userPrompt);
        break;
      case "anthropic":
        tradeAction = await this.callAnthropic(userPrompt);
        break;
      case "google":
        tradeAction = await this.callGemini(userPrompt);
        break;
      default:
        throw new Error(`Unknown provider: ${agent.provider}`);
    }

    logger.info(`Agent ${agent.name} decision: ${tradeAction?.action || "NONE"} on market ${tradeAction?.market_id || "N/A"}`, {
      source: "agent",
      metadata: { agentId: agent.id, action: tradeAction?.action },
    });

    return {
      agentId: agent.id,
      agentName: agent.name,
      tradeAction,
    };
  }

  private async callOpenAI(prompt: string): Promise<TradeAction | null> {
    if (!this.openaiClient) {
      throw new Error("OpenAI client not initialized (missing OPENAI_API_KEY)");
    }

    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const response = await this.openaiClient.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: AGENT_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    return this.parseTradeAction(content);
  }

  private async callXAI(prompt: string): Promise<TradeAction | null> {
    if (!this.xaiClient) {
      throw new Error("xAI client not initialized (missing XAI_API_KEY)");
    }

    const response = await this.xaiClient.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        { role: "system", content: AGENT_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    return this.parseTradeAction(content);
  }

  private async callAnthropic(prompt: string): Promise<TradeAction | null> {
    if (!this.anthropicClient) {
      throw new Error("Anthropic client not initialized (missing ANTHROPIC_API_KEY)");
    }

    // claude-sonnet-4-20250514 is the latest model
    const response = await this.anthropicClient.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: AGENT_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: prompt },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") return null;

    return this.parseTradeAction(content.text);
  }

  private async callGemini(prompt: string): Promise<TradeAction | null> {
    if (!this.geminiClient) {
      throw new Error("Gemini client not initialized (missing GEMINI_API_KEY)");
    }

    const response = await this.geminiClient.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: AGENT_SYSTEM_PROMPT,
        responseMimeType: "application/json",
      },
      contents: prompt,
    });

    const text = response.text;
    if (!text) return null;

    return this.parseTradeAction(text);
  }

  private parseTradeAction(content: string): TradeAction | null {
    try {
      // Clean up the content - remove markdown code blocks if present
      let cleaned = content.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.slice(7);
      }
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith("```")) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);

      // Validate required fields
      if (!parsed.action || !["BUY", "SELL", "HOLD"].includes(parsed.action)) {
        return null;
      }

      if (parsed.action === "HOLD") {
        return {
          action: "HOLD",
          market_id: parsed.market_id || "",
          side: parsed.side || "YES",
          size_usd: 0,
          max_price: 0,
          reasoning: parsed.reasoning || "No action taken",
        };
      }

      if (!parsed.market_id || !parsed.side || !parsed.size_usd) {
        return null;
      }

      return {
        action: parsed.action,
        market_id: parsed.market_id,
        side: parsed.side,
        size_usd: Math.min(parsed.size_usd, 50), // Enforce max
        max_price: parsed.max_price || 1,
        reasoning: parsed.reasoning || "No reasoning provided",
      };
    } catch (error) {
      logger.warn(`Failed to parse trade action: ${error}`, {
        source: "agent",
        metadata: { content: content.substring(0, 200) },
      });
      return null;
    }
  }
}

export const aiAgentService = new AIAgentService();
