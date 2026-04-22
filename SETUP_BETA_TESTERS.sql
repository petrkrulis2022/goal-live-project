-- COPY AND PASTE THIS ENTIRE BLOCK INTO SUPABASE SQL EDITOR
-- Go to: https://supabase.com/dashboard → Your Project → SQL Editor → New Query
-- Then paste everything below and click RUN

-- Create beta_testers table
CREATE TABLE IF NOT EXISTS public.beta_testers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  name TEXT NOT NULL,
  telegram TEXT NOT NULL,
  discord TEXT NOT NULL,
  solana_wallet TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'approved', 'denied', 'completed')),
  testnet_usdc_sent BOOLEAN DEFAULT false,
  testnet_send_date TIMESTAMP WITH TIME ZONE,
  testnet_amount_sent NUMERIC(20, 6) DEFAULT 1000.0,
  mainnet_winnings NUMERIC(20, 6) DEFAULT 0.0,
  mainnet_winnings_date TIMESTAMP WITH TIME ZONE,
  mainnet_tx_hash TEXT,
  feedback TEXT,
  bugs_reported INTEGER DEFAULT 0,
  sessions_played INTEGER DEFAULT 0,
  total_tests_participated INTEGER DEFAULT 0
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_beta_testers_wallet ON public.beta_testers(solana_wallet);
CREATE INDEX IF NOT EXISTS idx_beta_testers_status ON public.beta_testers(status);
CREATE INDEX IF NOT EXISTS idx_beta_testers_created ON public.beta_testers(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.beta_testers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public insert" ON public.beta_testers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public select" ON public.beta_testers
  FOR SELECT USING (true);

-- Create RPC function to bypass schema cache
DROP FUNCTION IF EXISTS public.get_beta_testers_list();

CREATE OR REPLACE FUNCTION public.get_beta_testers_list()
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  name TEXT,
  telegram TEXT,
  discord TEXT,
  solana_wallet TEXT,
  status TEXT,
  testnet_usdc_sent BOOLEAN,
  testnet_send_date TIMESTAMP WITH TIME ZONE,
  testnet_amount_sent NUMERIC,
  mainnet_winnings NUMERIC,
  mainnet_winnings_date TIMESTAMP WITH TIME ZONE,
  mainnet_tx_hash TEXT,
  feedback TEXT,
  bugs_reported INTEGER,
  sessions_played INTEGER,
  total_tests_participated INTEGER
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    id, created_at, updated_at, name, telegram, discord, solana_wallet, status,
    testnet_usdc_sent, testnet_send_date, testnet_amount_sent,
    mainnet_winnings, mainnet_winnings_date, mainnet_tx_hash, feedback,
    bugs_reported, sessions_played, total_tests_participated
  FROM public.beta_testers
  ORDER BY created_at DESC;
$$;

-- Grant permissions on function
GRANT EXECUTE ON FUNCTION public.get_beta_testers_list() TO anon, authenticated, service_role;
