const { Resend } = require('resend');
const { getPool } = require('../config/db');

/**
 * Ensures the leads table exists
 */
const createTableIfNotExists = async () => {
  const pool = getPool();
  if (!pool) return;

  const query = `
    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      company_name TEXT,
      role TEXT,
      team_size TEXT,
      savings_amount NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;
  await pool.query(query);
};

/**
 * Controller for Lead Capture
 */
const captureLead = async (req, res, next) => {
  try {
    const { 
      email, 
      companyName, 
      role, 
      teamSize, 
      savingsAmount, 
      honeypot 
    } = req.body;
    
    // 1. Honeypot check for spam protection
    if (honeypot) {
      console.warn('Honeypot triggered by request:', req.body);
      return res.status(400).json({ 
        success: false, 
        message: 'Spam detected.' 
      });
    }

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required.' 
      });
    }

    // 2. Ensure table exists & Save to Database
    let leadId = null;
    if (process.env.DATABASE_URL) {
      try {
        // Create table if it doesn't exist
        await createTableIfNotExists();

        const pool = getPool();
        if (!pool) throw new Error('Database pool not available');

        // Insert lead
        const insertQuery = `
          INSERT INTO leads (email, company_name, role, team_size, savings_amount)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id;
        `;
        const values = [
          email, 
          companyName, 
          role, 
          teamSize, 
          parseFloat(savingsAmount) || 0
        ];
        
        const result = await pool.query(insertQuery, values);
        leadId = result.rows[0].id;
        console.log('Lead saved successfully to database.');
      } catch (dbError) {
        console.error('Database Operation Error:', dbError);
        // We continue with email even if DB fails, or we can choose to throw
        // throw new Error('Database error'); 
      }
    } else {
      console.warn('DATABASE_URL not found. Skipping database storage.');
    }

    // 3. Send Transactional Email via Resend
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      const isHighSavings = parseFloat(savingsAmount) >= 500;
      
      const emailSubject = isHighSavings 
        ? 'Your Priority AI Audit Report - GetPriced' 
        : 'Your AI Audit Report - GetPriced';

      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #51bc8f;">Hello! Here is your AI Audit Report</h2>
          <p>Thank you for using GetPriced. We've captured your audit results and our team is reviewing them.</p>
          
          <div style="background: #f8f9fb; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #111;">Estimated Monthly Savings:</p>
            <p style="font-size: 24px; color: #51bc8f; margin: 5px 0;">$${savingsAmount}/mo</p>
          </div>

          ${isHighSavings ? `
            <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; font-weight: bold; color: #92400e;">Priority Status: High Savings Identified</p>
              <p style="margin: 5px 0 0 0;">A Credex consultant will reach out to you within 24 hours to discuss claiming your credits and optimizing your stack further.</p>
            </div>
          ` : `
            <p>We'll notify you when new optimizations apply to your stack.</p>
          `}

          <p>Best regards,<br/>The GetPriced Team</p>
        </div>
      `;

      try {
        await resend.emails.send({
          from: 'GetPriced <onboarding@resend.dev>',
          to: email,
          subject: emailSubject,
          html: emailHtml,
        });
        console.log('Transactional email sent.');
      } catch (emailError) {
        console.error('Resend Email Error:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Lead captured successfully.',
      leadId
    });

  } catch (error) {
    console.error('Lead Capture Error:', error);
    next(error);
  }
};

module.exports = {
  captureLead,
};
