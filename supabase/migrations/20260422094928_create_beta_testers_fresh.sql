-- Fresh creation of beta_testers table for beta testing program
CREATE TABLE IF NOT EXISTS public.beta_testers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  name text NOT NULL,
  telegram text NOT NULL,
  discord text NOT NULL,
  solana_wallet text NOT NULL UNIQUE,
  status text DEFAULT 'registered' CHECK (status IN ('registered', 'approved', 'denied', 'completed')),
  testnet_usdc_sent boolean DEFAULT false,
  testnet_send_date timestamp with time zone,
  testnet_amount_sent numeric(20, 6) DEFAULT 1000.0,
  mainnet_winnings numeric(20, 6) DEFAULT 0.0,
  mainnet_winnings_date timestamp with time zone,
  mainnet_tx_hash text,
  feedback text,
  bugs_reported integer DEFAULT 0,
  sessions_played integer DEFAULT 0,
  total_tests_participated integer DEFAULT 0
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_beta_testers_wallet ON public.beta_testers(solana_wallet);
CREATE INDEX IF NOT EXISTS idx_beta_testers_status ON public.beta_testers(status);
CREATE INDEX IF NOT EXISTS idx_beta_testers_created ON public.beta_testers(created_at DESC);

-- Enable RLS
ALTER TABLE public.beta_testers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow anonymous insertions" ON public.beta_testers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow reads" ON public.beta_testers
  FOR SELECT USING (true);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_beta_testers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_beta_testers_updated_at
  BEFORE UPDATE ON public.beta_testers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_beta_testers_updated_at();
