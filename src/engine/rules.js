/**
 * Hardcoded evaluation rules for SaaS tools based on detailed market pricing.
 * Each tool key must match the normalized tool name from the UI.
 */

const pricingDictionary = {
  cursor: { hobby: 0, pro: 20, pro_plus: 60, ultra: 200, teams: 40 },
  github_copilot: { free: 0, pro: 10, pro_plus: 39, business: 19, enterprise: 39 },
  claude: { free: 0, pro: 20, max_5x: 100, team_standard: 25, team_premium: 125 },
  chatgpt: { free: 0, go: 8, plus: 20, pro_100: 100, pro_200: 200, business: 25 },
  windsurf: { free: 0, pro: 15, max: 200, teams: 30 }
};

const toolRules = {
  'cursor': (tool) => {
    const users = tool.usersCount || 1;
    const spend = tool.customCost || tool.planCost || 0;
    const plan = tool.plan.toLowerCase();
    
    // Rule: Ultra is extremely expensive ($200)
    if (plan === 'ultra') {
      const proCost = pricingDictionary.cursor.pro * users;
      return {
        recommendedAction: "Downgrade to Cursor Pro",
        savings: spend - proCost,
        reason: "The Ultra tier ($200/mo) is designed for massive, continuous fast requests. 99% of engineers are perfectly served by the Pro tier ($20/mo), saving $180 per user."
      };
    }
    // Rule: Pro+ ($60) vs Pro ($20)
    if (plan === 'pro+') {
      const proCost = pricingDictionary.cursor.pro * users;
      return {
        recommendedAction: "Downgrade to Cursor Pro",
        savings: spend - proCost,
        reason: "Pro+ offers additional fast requests, but falling back to normal speeds on the standard Pro plan is usually imperceptible and saves $40 per user monthly."
      };
    }
    // Rule: Teams plan ($40/user) vs Pro ($20/user) for small groups
    if (users <= 4 && plan === 'teams') {
      const proCost = pricingDictionary.cursor.pro * users;
      if (spend > proCost) {
        return {
          recommendedAction: "Downgrade to Individual Pro Accounts",
          savings: spend - proCost,
          reason: `Centralized billing on the Teams plan costs 100% more ($40 vs $20). For ${users} users, individual Pro accounts are much more cost-effective.`
        };
      }
    }
    return null;
  },

  'github_copilot': (tool) => {
    const users = tool.usersCount || 1;
    const spend = tool.customCost || tool.planCost || 0;
    const plan = tool.plan.toLowerCase();

    // Rule: Pro+ or Enterprise is overkill for small teams
    if (users < 10 && (plan === 'enterprise' || plan === 'pro+')) {
      const proCost = pricingDictionary.github_copilot.pro * users;
      return {
        recommendedAction: "Downgrade to Copilot Pro",
        savings: Math.max(0, spend - proCost),
        reason: "Enterprise ($39) and Pro+ ($39) offer org-wide policy management and fine-tuned models. Micro-teams can get the exact same core code generation with Copilot Pro ($10)."
      };
    }
    // Rule: Business vs Pro for small teams
    if (users <= 3 && plan === 'business') {
      const proCost = pricingDictionary.github_copilot.pro * users;
      return {
        recommendedAction: "Downgrade to Copilot Pro",
        savings: Math.max(0, spend - proCost),
        reason: "At $19/mo, Business tier's main draw is IP indemnity and central billing. For 3 or fewer seats, individual Pro accounts ($10/mo) cut costs nearly in half."
      };
    }
    return null;
  },

  'claude': (tool) => {
    const users = tool.usersCount || 1;
    const spend = tool.customCost || tool.planCost || 0;
    const plan = tool.plan.toLowerCase();

    // Rule: Team Premium vs Team Standard
    if (plan.includes('team premium')) {
      const standardCost = pricingDictionary.claude.team_standard * users;
      return {
        recommendedAction: "Downgrade to Team Standard",
        savings: spend - standardCost,
        reason: "Team Premium ($125/mo) offers 5x usage limits, but Team Standard ($25/mo) is generally sufficient unless you are consistently hitting rate limits on massive context windows."
      };
    }
    // Rule: Max tiers (Consumer)
    if (plan.includes('max')) {
      return {
        recommendedAction: "Switch to API-based usage via a UI client",
        savings: Math.max(0, spend - 20),
        reason: "High-tier consumer subscriptions like Max 5x ($100/mo) are rigid. Using the Anthropic API directly with an open-source UI like TypingMind often costs significantly less for equivalent volume."
      };
    }
    return null;
  },

  'chatgpt': (tool) => {
    const users = tool.usersCount || 1;
    const spend = tool.customCost || tool.planCost || 0;
    const plan = tool.plan.toLowerCase();

    // Rule: Pro tiers
    if (plan.includes('pro ($200)') || plan.includes('pro ($100)')) {
      const targetCost = pricingDictionary.chatgpt.plus * users;
      return {
        recommendedAction: "Downgrade to Plus ($20) or Business ($25)",
        savings: spend - targetCost,
        reason: "The $100/$200 Pro tiers offer o1/o3 'Pro' versions and unlimited usage. This is heavy overkill for 95% of knowledge workers. Base Plus or Business covers standard daily needs."
      };
    }
    // Rule: Go vs Plus
    if (plan === 'go') {
      return {
        recommendedAction: "Monitor usage, consider Free tier",
        savings: spend, 
        reason: "The $8/mo Go tier bridges the gap, but OpenAI's Free tier now includes robust GPT-4o access. If usage is light, the Free tier might suffice."
      };
    }
    return null;
  },

  'anthropic_api': (tool) => {
    const spend = tool.customCost || 0;
    const plan = tool.plan.toLowerCase();
    
    // Rule: Opus optimization
    if (plan.includes('opus') && tool.useCase && !tool.useCase.includes('coding')) {
      return {
        recommendedAction: "Route non-coding tasks to Sonnet 4.6 or Haiku 4.5",
        savings: spend * 0.6, 
        reason: "Opus 4.7 is highly expensive ($5 in / $25 out). For general writing, data, or search, Sonnet 4.6 ($3 in / $15 out) or Haiku 4.5 ($1 in / $5 out) provide near-identical quality at a fraction of the cost."
      };
    }
    return null;
  },

  'openai_api': (tool) => {
    const spend = tool.customCost || 0;
    const plan = tool.plan.toLowerCase();

    // Rule: GPT-5.5 Pro is wildly expensive
    if (plan.includes('gpt-5.5 pro')) {
      return {
        recommendedAction: "Downgrade to standard GPT-5.5 or GPT-5.4",
        savings: spend * 0.8,
        reason: "GPT-5.5 Pro is exorbitantly priced ($30 in / $180 out). Standard GPT-5.5 ($5 / $30) or GPT-5.4 ($2.50 / $15) deliver flagship intelligence at vastly lower rates."
      };
    }

    // Rule: Legacy/Expensive models vs Mini variants
    if (['gpt-5', 'gpt-5.4', 'gpt-4o', 'o3 pro'].includes(plan)) {
      return {
        recommendedAction: "Migrate background/batch tasks to 'Mini' or 'Nano' variants",
        savings: spend * 0.75,
        reason: "You are using flagship models. Routing summarization, classification, and extraction tasks to GPT-5.4 Mini ($0.75 / $4.50) or GPT-4o Mini ($0.15 / $0.60) can reduce API costs by over 75%."
      };
    }
    return null;
  },

  'gemini': (tool) => {
    const spend = tool.customCost || 0;
    const plan = tool.plan.toLowerCase();
    const processingMode = tool.processingMode?.toLowerCase() || 'standard';

    // Rule: Batch processing
    if (processingMode !== 'batch' && (tool.useCase && tool.useCase.includes('data') || tool.useCase.includes('automation'))) {
      return {
        recommendedAction: "Implement Gemini Batch API for async tasks",
        savings: spend * 0.5,
        reason: "Google offers a flat 50% discount on all API calls routed through their Batch API. For asynchronous data processing and automation, this is pure cost reduction."
      };
    }

    // Rule: Pro vs Flash
    if (plan.includes('pro')) {
      return {
        recommendedAction: "Test 'Flash' or 'Flash-Lite' tiers for high-volume endpoints",
        savings: spend * 0.75, 
        reason: "Gemini Pro models are powerful but costly ($2.00 / $12.00). The Flash series ($0.50 / $3.00) or Flash-Lite ($0.10 / $0.40) are optimized for speed and cost, yielding massive savings for standard tasks."
      };
    }
    return null;
  },

  'windsurf': (tool) => {
    const users = tool.usersCount || 1;
    const spend = tool.customCost || tool.planCost || 0;
    const plan = tool.plan.toLowerCase();

    // Rule: Max tier overkill
    if (plan === 'max') {
      const proCost = pricingDictionary.windsurf.pro * users;
      return {
        recommendedAction: "Downgrade to Windsurf Pro",
        savings: spend - proCost,
        reason: "The Max tier ($200/mo) provides extreme usage allowances. Unless you are constantly hitting the 500 credit limit on Pro ($15/mo), Max is financially inefficient."
      };
    }

    // Rule: Teams vs Pro markup
    if (users <= 4 && plan === 'teams') {
      const proCost = pricingDictionary.windsurf.pro * users;
      if (spend > proCost) {
        return {
          recommendedAction: "Downgrade to Windsurf Pro",
          savings: spend - proCost,
          reason: `Teams pricing ($30/mo) is double the Pro tier ($15/mo) just for a dashboard. For ${users} users, individual Pro accounts save 50% while maintaining SWE-1 model access.`
        };
      }
    }
    return null;
  }
};

module.exports = {
  toolRules,
  pricingDictionary
};
