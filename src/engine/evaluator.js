const { toolRules } = require('./rules');

/**
 * Normalizes tool names for dictionary matching.
 * e.g., "Google Workspace" -> "google_workspace"
 */
const normalizeName = (name) => {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/[\s-]+/g, '_');
};

/**
 * Primary evaluation function for the SaaS Audit Engine.
 * Processes an array of user-submitted tools against hardcoded rules.
 * 
 * @param {Array} tools - Array of tool objects from the user payload.
 * @returns {Object} - Structured JSON containing breakdown and totals.
 */
const evaluateStack = (tools) => {
  if (!Array.isArray(tools)) {
    throw new Error('Input must be an array of tools.');
  }

  const breakdown = [];
  let totalMonthlySavings = 0;
  let totalCurrentSpend = 0;

  tools.forEach((tool) => {
    // 1. Calculate current spend
    const users = tool.usersCount || 1;
    // Assume customCost represents total monthly spend if provided, otherwise calculate from planCost
    const currentSpend = tool.customCost > 0 ? tool.customCost : (tool.planCost * users) || 0;
    
    totalCurrentSpend += currentSpend;

    // 2. Find matching rules
    const normalizedKey = normalizeName(tool.name);
    const ruleEngine = toolRules[normalizedKey];

    if (ruleEngine) {
      // Execute the hardcoded rule
      const optimization = ruleEngine({ ...tool, customCost: currentSpend, usersCount: users });

      if (optimization) {
        // Ensure savings are logically bounded (can't save more than you spend)
        const verifiedSavings = Math.min(Math.max(0, optimization.savings), currentSpend);

        breakdown.push({
          tool_name: tool.name,
          plan: tool.plan,
          users_count: users,
          use_case: tool.useCase,
          current_estimated_monthly_spend: currentSpend,
          recommended_action: optimization.recommendedAction,
          estimated_monthly_savings: verifiedSavings,
          reasoning: optimization.reason
        });

        totalMonthlySavings += verifiedSavings;
        return; // Skip default logic if a specific rule triggered
      }
    }

    // Default fallback if no rules apply or trigger
    breakdown.push({
      tool_name: tool.name,
      plan: tool.plan,
      users_count: users,
      use_case: tool.useCase,
      current_estimated_monthly_spend: currentSpend,
      recommended_action: "Maintain current plan",
      estimated_monthly_savings: 0,
      reasoning: "Current plan appears optimal for your team size and stated usage."
    });
  });

  return {
    per_tool_breakdown: breakdown,
    total_monthly_savings: totalMonthlySavings,
    total_annual_savings: totalMonthlySavings * 12,
    total_current_monthly_spend: totalCurrentSpend,
    strategic_summary: totalMonthlySavings > 0 
      ? `We found actionable ways to reduce your software footprint. Implementing these changes could save you $${(totalMonthlySavings * 12).toLocaleString()} annually.`
      : "Your stack is highly optimized. No immediate financial changes recommended."
  };
};

module.exports = {
  evaluateStack
};
