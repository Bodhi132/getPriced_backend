const Groq = require('groq-sdk');
const { evaluateStack } = require('../engine/evaluator');
const { getPool } = require('../config/db');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Ensures audit tables exist
 */
const createAuditTables = async () => {
  const pool = getPool();
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT,
        total_monthly_spend NUMERIC DEFAULT 0,
        total_monthly_savings NUMERIC DEFAULT 0,
        strategic_summary TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_tools (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
        tool_name TEXT NOT NULL,
        plan TEXT NOT NULL,
        users_count INTEGER NOT NULL DEFAULT 1,
        use_case TEXT NOT NULL,
        estimated_monthly_savings NUMERIC DEFAULT 0,
        recommended_action TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  `);
};

/**
 * Controller for SaaS Subscription Audit
 */
const runAudit = async (req, res, next) => {
  try {
    const { email, tools } = req.body;
    const pool = getPool();

    if (!tools || !Array.isArray(tools) || tools.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No tools provided for audit.' 
      });
    }

    // 1. Hardcoded Evaluation
    const calculatedResults = evaluateStack(tools);

    // 2. Extract context for the LLM
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

    // 3. Call Groq API for Personalized Executive Summary
    const systemPrompt = `You are a sharp, modern fractional CFO advising a startup founder.
Your goal is to provide a highly personalized summary of their SaaS spend audit.
Rules:
- Generate a single paragraph (maximum 100 words).
- Highlight the biggest area of waste.
- Output ONLY the paragraph text.`;

    const userPrompt = `Audit results: ${JSON.stringify(llmContext, null, 2)}`;

    let executiveSummary = "Our analysis identifies significant optimization opportunities in your current SaaS stack.";
    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: 'openai/gpt-oss-120b',
      });
      executiveSummary = chatCompletion.choices[0].message.content.trim();
    } catch (llmErr) {
      console.error('Groq Error:', llmErr);
    }
    
    calculatedResults.strategic_summary = executiveSummary;

    // 4. Persistence & ID Generation
    const crypto = require('crypto');
    let auditId = crypto.randomUUID();

    if (pool) {
      try {
        await createAuditTables();

        await pool.query(`
          INSERT INTO audits (id, email, total_monthly_spend, total_monthly_savings, strategic_summary)
          VALUES ($1, $2, $3, $4, $5);
        `, [auditId, email, calculatedResults.total_current_monthly_spend, calculatedResults.total_monthly_savings, executiveSummary]);

        for (const tool of calculatedResults.per_tool_breakdown) {
          await pool.query(`
            INSERT INTO audit_tools (audit_id, tool_name, plan, users_count, use_case, estimated_monthly_savings, recommended_action)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            auditId, 
            tool.tool_name, 
            tool.plan, 
            tool.users_count, 
            tool.use_case, 
            tool.estimated_monthly_savings, 
            tool.recommended_action
          ]);
        }
        console.log('Audit saved with ID:', auditId);
      } catch (dbErr) {
        console.error('Audit Persistence Error:', dbErr);
        // We still have the generated auditId, though it won't be in the DB
      }
    }

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

/**
 * Fetch Public Audit (Masked)
 */
const getPublicAudit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Validate ID
    if (!id || id === 'undefined' || id.length < 32) {
      return res.status(400).json({ success: false, message: 'Invalid or missing Audit ID' });
    }

    if (!pool) {
      return res.status(500).json({ success: false, message: 'Database connection failed' });
    }

    const auditResult = await pool.query(`
      SELECT id, total_monthly_spend, total_monthly_savings, strategic_summary, created_at 
      FROM audits 
      WHERE id = $1
    `, [id]);

    if (auditResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Audit not found' });
    }

    const toolsResult = await pool.query(`
      SELECT tool_name, plan, users_count, use_case, estimated_monthly_savings, recommended_action
      FROM audit_tools
      WHERE audit_id = $1
    `, [id]);

    res.status(200).json({
      success: true,
      data: {
        ...auditResult.rows[0],
        per_tool_breakdown: toolsResult.rows
      }
    });
  } catch (error) {
    console.error('Fetch Public Audit Error:', error);
    next(error);
  }
};

module.exports = {
  runAudit,
  getPublicAudit
};

