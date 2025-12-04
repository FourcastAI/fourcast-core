import { config } from "../config";
import { storage } from "../storage";
import { logger } from "./logger";
import type { Market, InsertMarket } from "@shared/schema";

// Data collection service for Polymarket, Twitter, and Brave Search

interface PolymarketMarket {
  condition_id: string;
  question: string;
  description?: string;
  category?: string;
  end_date_iso?: string;
  volume?: string;
  liquidity?: string;
  active?: boolean;
  closed?: boolean;
  outcomes?: string[];
  tokens?: Array<{
    token_id: string;
    outcome: string;
    price: number;
  }>;
}

interface PolymarketPriceData {
  token_id: string;
  price: number;
  bid: number;
  ask: number;
}

interface TwitterTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
  };
}

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

interface CollectedData {
  markets: Market[];
  tweets: TwitterTweet[];
  news: BraveSearchResult[];
  timestamp: Date;
}

export class DataCollector {
  private polymarketBaseUrl: string;
  private twitterBaseUrl: string;
  private braveBaseUrl: string;

  constructor() {
    this.polymarketBaseUrl = config.apis.polymarket.gammaUrl;
    this.twitterBaseUrl = config.apis.twitter.baseUrl;
    this.braveBaseUrl = config.apis.braveSearch.baseUrl;
  }

  async collectAll(): Promise<CollectedData> {
    logger.info("Starting data collection cycle", { source: "data_collector" });

    const [markets, tweets, news] = await Promise.all([
      this.collectPolymarketData(),
      this.collectTwitterData(),
      this.collectBraveSearchData(),
    ]);

    logger.info(`Data collection complete: ${markets.length} markets, ${tweets.length} tweets, ${news.length} news articles`, {
      source: "data_collector",
      metadata: { marketsCount: markets.length, tweetsCount: tweets.length, newsCount: news.length },
    });

    return {
      markets,
      tweets,
      news,
      timestamp: new Date(),
    };
  }

  async collectPolymarketData(): Promise<Market[]> {
    try {
      // Fetch active markets from Polymarket Gamma API
      const response = await fetch(`${this.polymarketBaseUrl}/markets?limit=50&active=true`);
      
      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
      }

      const data = await response.json() as PolymarketMarket[];
      const markets: Market[] = [];

      for (const pm of data) {
        if (!pm.condition_id || !pm.question) continue;

        // Check if market exists
        let market = await storage.getMarketByPolymarketId(pm.condition_id);

        // Determine prices from tokens
        let yesPrice = "0.5";
        let noPrice = "0.5";

        if (pm.tokens && pm.tokens.length >= 2) {
          const yesToken = pm.tokens.find((t) => t.outcome.toLowerCase() === "yes");
          const noToken = pm.tokens.find((t) => t.outcome.toLowerCase() === "no");
          if (yesToken) yesPrice = yesToken.price.toString();
          if (noToken) noPrice = noToken.price.toString();
        }

        const marketData: InsertMarket = {
          polymarketId: pm.condition_id,
          question: pm.question,
          category: pm.category || "Other",
          endDate: pm.end_date_iso ? new Date(pm.end_date_iso) : null,
          volume: pm.volume || "0",
          liquidity: pm.liquidity || "0",
          yesPrice,
          noPrice,
          isResolved: pm.closed || false,
          outcome: null,
        };

        if (market) {
          // Update existing market
          const updated = await storage.updateMarket(market.id, marketData);
          if (updated) markets.push(updated);
        } else {
          // Create new market
          market = await storage.createMarket(marketData);
          markets.push(market);
        }

        // Create market snapshot
        await storage.createMarketSnapshot({
          marketId: market.id,
          yesPrice,
          noPrice,
          volume: pm.volume || "0",
          sentimentScore: "0",
          newsCount: 0,
        });
      }

      logger.info(`Collected ${markets.length} markets from Polymarket`, { source: "data_collector" });
      return markets;
    } catch (error) {
      logger.error(`Failed to collect Polymarket data: ${error}`, { 
        source: "data_collector",
        metadata: { error: String(error) },
      });
      
      // Return existing markets from database on error
      return storage.getMarkets();
    }
  }

  async collectTwitterData(): Promise<TwitterTweet[]> {
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    
    if (!bearerToken) {
      logger.warn("Twitter API not configured (TWITTER_BEARER_TOKEN missing)", { source: "data_collector" });
      return [];
    }

    try {
      // Search for prediction market related tweets
      const query = encodeURIComponent("polymarket OR prediction market OR election odds -is:retweet lang:en");
      const response = await fetch(
        `${this.twitterBaseUrl}/tweets/search/recent?query=${query}&max_results=50&tweet.fields=created_at,public_metrics,author_id`,
        {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const data = await response.json();
      const tweets: TwitterTweet[] = data.data || [];

      logger.info(`Collected ${tweets.length} tweets`, { source: "data_collector" });
      return tweets;
    } catch (error) {
      logger.error(`Failed to collect Twitter data: ${error}`, { 
        source: "data_collector",
        metadata: { error: String(error) },
      });
      return [];
    }
  }

  async collectBraveSearchData(): Promise<BraveSearchResult[]> {
    const apiKey = process.env.BRAVE_API_KEY;
    
    if (!apiKey) {
      logger.warn("Brave Search API not configured (BRAVE_API_KEY missing)", { source: "data_collector" });
      return [];
    }

    try {
      // Search for prediction market news
      const queries = [
        "prediction market news",
        "polymarket election",
        "crypto market forecast",
      ];

      const allResults: BraveSearchResult[] = [];

      for (const query of queries) {
        const response = await fetch(
          `${this.braveBaseUrl}/web/search?q=${encodeURIComponent(query)}&count=10&freshness=pd`,
          {
            headers: {
              "Accept": "application/json",
              "X-Subscription-Token": apiKey,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Brave Search API error: ${response.status}`);
        }

        const data = await response.json();
        const results: BraveSearchResult[] = (data.web?.results || []).map((r: any) => ({
          title: r.title,
          url: r.url,
          description: r.description,
          age: r.age,
        }));

        allResults.push(...results);
      }

      // Deduplicate by URL
      const seen = new Set<string>();
      const unique = allResults.filter((r) => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });

      logger.info(`Collected ${unique.length} news articles from Brave Search`, { source: "data_collector" });
      return unique;
    } catch (error) {
      logger.error(`Failed to collect Brave Search data: ${error}`, { 
        source: "data_collector",
        metadata: { error: String(error) },
      });
      return [];
    }
  }

  // Format collected data for AI agents
  formatForAgents(data: CollectedData): string {
    const { markets, tweets, news, timestamp } = data;

    let formatted = `# Market Intelligence Report\n`;
    formatted += `Generated: ${timestamp.toISOString()}\n\n`;

    // Markets section
    formatted += `## Active Markets (${markets.length})\n\n`;
    for (const market of markets.slice(0, 20)) {
      formatted += `### ${market.question}\n`;
      formatted += `- Category: ${market.category}\n`;
      formatted += `- YES Price: ${market.yesPrice} | NO Price: ${market.noPrice}\n`;
      formatted += `- Volume: $${parseFloat(market.volume || "0").toLocaleString()}\n`;
      formatted += `- Liquidity: $${parseFloat(market.liquidity || "0").toLocaleString()}\n`;
      formatted += `- Market ID: ${market.id}\n\n`;
    }

    // Social sentiment section
    if (tweets.length > 0) {
      formatted += `## Social Sentiment (${tweets.length} tweets)\n\n`;
      for (const tweet of tweets.slice(0, 10)) {
        formatted += `- "${tweet.text.substring(0, 200)}..."\n`;
        if (tweet.public_metrics) {
          formatted += `  (${tweet.public_metrics.like_count} likes, ${tweet.public_metrics.retweet_count} RTs)\n`;
        }
      }
      formatted += `\n`;
    }

    // News section
    if (news.length > 0) {
      formatted += `## Recent News (${news.length} articles)\n\n`;
      for (const article of news.slice(0, 10)) {
        formatted += `- **${article.title}**\n`;
        formatted += `  ${article.description?.substring(0, 150)}...\n`;
        if (article.age) formatted += `  (${article.age})\n`;
        formatted += `\n`;
      }
    }

    return formatted;
  }
}

export const dataCollector = new DataCollector();
