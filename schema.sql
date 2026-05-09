-- schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Audits table
CREATE TABLE audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Audit Tools table
CREATE TABLE audit_tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    plan TEXT NOT NULL,
    users_count INTEGER NOT NULL DEFAULT 1,
    use_case TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) Policies
-- (Optional: Configure appropriately if you plan to access Supabase directly from frontend later)
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_tools ENABLE ROW LEVEL SECURITY;

-- Allow insert from anon (so backend can insert) and service_role
CREATE POLICY "Allow public insert on audits" ON audits FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on audit_tools" ON audit_tools FOR INSERT WITH CHECK (true);
