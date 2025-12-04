// FOURCAST Configuration
// All API keys should be provided via environment variables

export const config = {
  // System Settings
  system: {
    autoStartScheduler: process.env.AUTO_START_SCHEDULER === "true", // Auto-start trading on server launch
  },

  // Trading Parameters
  trading: {
    initialBalance: 500, // USDC per agent
    maxTradePercent: 0.10, // 10% max per trade
    maxDailyVolumePercent: 0.40, // 40% max daily volume
    minLiquidity: 1000, // Minimum liquidity in USDC
    tickIntervalMinutes: 15, // Trading cycle interval
  },

  // Risk Limits
  risk: {
    maxPositionSize: 50, // Max 50 USDC per position
    maxOpenPositions: 10, // Max positions per agent
    stopLossPercent: 0.20, // 20% stop loss
  },

  // API Endpoints
  apis: {
    polymarket: {
      baseUrl: "https://clob.polymarket.com",
      gammaUrl: "https://gamma-api.polymarket.com",
    },
    twitter: {
      baseUrl: "https://api.twitter.com/2",
    },
    braveSearch: {
      baseUrl: "https://api.search.brave.com/res/v1",
    },
  },

  // AI Models
  models: {
    gpt5: {
      name: "GPT-5",
      model: "gpt-5",
      provider: "openai",
      color: "#14b8a6",
      strategy: "Balanced macro + sentiment hybrid. Analyzes broader economic trends while incorporating social sentiment for timing decisions. Focuses on medium-term positions with calculated risk exposure.",
    },
    grok: {
      name: "Grok-4",
      model: "grok-4",
      provider: "xai",
      color: "#a855f7",
      strategy: "Aggressive short-term opportunist. Exploits rapid market movements and sentiment shifts. Higher turnover with focus on quick profit-taking and momentum plays.",
    },
    claude: {
      name: "Claude-Opus-4.5",
      model: "claude-opus-4-5-20250514",
      provider: "anthropic",
      color: "#f97316",
      strategy: "Statistics and probability-focused risk-averse trader. Relies heavily on historical patterns and mathematical edge. Prefers high-probability setups with defined risk parameters.",
    },
    gemini: {
      name: "Gemini-3-Pro",
      model: "gemini-3-pro",
      provider: "google",
      color: "#3b82f6",
      strategy: "News-driven cautious analyst. Prioritizes fundamental research, policy announcements, and roadmap tracking. Conservative positioning with emphasis on information edge.",
    },
  },
};

// Environment variable validation
export function validateEnv(): { isValid: boolean; missing: string[] } {
  const required = [
    "DATABASE_URL",
  ];

  const optional = [
    "OPENAI_API_KEY",
    "XAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "POLYMARKET_API_KEY",
    "POLYMARKET_API_SECRET",
    "POLYMARKET_PASSPHRASE",
    "POLYMARKET_PRIVATE_KEY",
    "TWITTER_BEARER_TOKEN",
    "BRAVE_API_KEY",
  ];

  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
  };
}

export function getConfiguredProviders(): string[] {
  const providers: string[] = [];
  
  if (process.env.OPENAI_API_KEY) providers.push("openai");
  if (process.env.XAI_API_KEY) providers.push("xai");
  if (process.env.ANTHROPIC_API_KEY) providers.push("anthropic");
  if (process.env.GEMINI_API_KEY) providers.push("google");

  return providers;
}
