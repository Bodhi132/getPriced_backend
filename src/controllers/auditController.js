const Groq = require('groq-sdk');
const { evaluateStack } = require('../engine/evaluator');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Controller for SaaS Subscription Audit
 */
const runAudit = async (req, res, next) => {
  try {
    const { email, tools } = req.body;
    const supabase = req.supabase;

    if (!tools || !Array.isArray(tools) || tools.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No tools provided for audit.' 
      });
    }

    // 1. Save to Supabase (if database is configured)
    let auditId = null;
    if (supabase && email) {
      try {
        const { data: audit, error: auditError } = await supabase
          .from('audits')
          .insert([{ email }])
          .select()
          .single();

        if (auditError) console.error('Supabase Audit Error:', auditError);
        else {
          auditId = audit.id;
          const toolRecords = tools.map((tool) => ({
            audit_id: auditId,
            tool_name: tool.name,
            plan: tool.plan,
            users_count: parseInt(tool.usersCount) || 1,
            use_case: tool.useCase
          }));

          const { error: toolsError } = await supabase
            .from('audit_tools')
            .insert(toolRecords);

          if (toolsError) console.error('Supabase Tools Error:', toolsError);
        }
      } catch (dbError) {
        console.error('Database connection error:', dbError);
      }
    }

    // 2. Hardcoded Evaluation
    const calculatedResults = evaluateStack(tools);

    // 3. Extract top context for the LLM
    const topFlags = [...calculatedResults.per_tool_breakdown]
      .filter(t => t.estimated_monthly_savings > 0)
      .sort((a, b) => b.estimated_monthly_savings - a.estimated_monthly_savings)
      .slice(0, 3)
      .map(t => `${t.tool_name}: Save $${t.estimated_monthly_savings}/mo by ${t.recommended_action}`);

    const llmContext = {
      total_monthly_spend: calculatedResults.total_current_monthly_spend,
      total_monthly_savings: calculatedResults.total_monthly_savings,
      top_flagged_tools: topFlags
    };

    // 4. Call Groq API for Personalized Executive Summary
    const systemPrompt = `You are a sharp, modern fractional CFO advising a startup founder.
Your goal is to provide a highly personalized, analytical, yet encouraging executive summary of their SaaS spend audit.
Rules:
- Generate a single paragraph (maximum 100 words).
- Highlight the biggest area of waste from the provided data.
- Validate the overall state of their stack.
- Tone: Professional, direct, numbers-driven.
- Output ONLY the paragraph text. Do NOT use markdown formatting, pleasantries, or JSON wrapping.`;

    const userPrompt = `Here are the results of the SaaS audit:
${JSON.stringify(llmContext, null, 2)}

Provide the executive summary paragraph.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'openai/gpt-oss-120b',
    });

    const executiveSummary = chatCompletion.choices[0].message.content.trim();
    calculatedResults.strategic_summary = executiveSummary;

    res.status(200).json({
      success: true,
      auditId,
      data: calculatedResults,
    });
  } catch (error) {
    console.error('Audit Processing Error:', error);
    next(error);
  }
};

module.exports = {
  runAudit,
};

