-- schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Audits table
CREATE TABLE audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    total_monthly_spend NUMERIC DEFAULT 0,
    total_monthly_savings NUMERIC DEFAULT 0,
    strategic_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Audit Tools table
CREATE TABLE audit_tools (
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

-- Create Leads table
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    company_name TEXT,
    role TEXT,
    team_size TEXT,
    savings_amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) Policies
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Allow insert from anon (so backend can insert) and service_role
CREATE POLICY "Allow public insert on audits" ON audits FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on audit_tools" ON audit_tools FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on leads" ON leads FOR INSERT WITH CHECK (true);
