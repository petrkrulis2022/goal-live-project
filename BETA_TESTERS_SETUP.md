# Supabase Beta Testers Database Setup

## Issue
You're seeing the error: "Could not find the table 'public.beta_testers' in the schema cache"

This is a known Supabase issue where PostgREST caches table metadata and sometimes gets out of sync. The table may exist in the database but PostgREST doesn't know about it.

## Solution - Run These SQL Queries

**Important**: You must run this SQL in your Supabase project directly.

### Step 1: Go to Supabase Dashboard
1. Navigate to https://supabase.com/dashboard
2. Select your **goal-live** project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**

### Step 2: Copy and Run This SQL

```sql
-- Step 1: Create beta_testers table
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

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_beta_testers_wallet ON public.beta_testers(solana_wallet);
CREATE INDEX IF NOT EXISTS idx_beta_testers_status ON public.beta_testers(status);
CREATE INDEX IF NOT EXISTS idx_beta_testers_created ON public.beta_testers(created_at DESC);

-- Step 3: Enable Row Level Security
ALTER TABLE public.beta_testers ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies
DROP POLICY IF EXISTS "Allow public insert" ON public.beta_testers;
DROP POLICY IF EXISTS "Allow public select" ON public.beta_testers;

CREATE POLICY "Allow public insert" ON public.beta_testers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public select" ON public.beta_testers
  FOR SELECT USING (true);

-- Step 5: Create RPC function to bypass schema cache
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

-- Step 6: Grant permissions
GRANT EXECUTE ON FUNCTION public.get_beta_testers_list() TO anon, authenticated, service_role;
```

### Step 3: Verify It Worked

After running the SQL, run this query to check if your registration exists:

```sql
SELECT COUNT(*) as total_registrations FROM public.beta_testers;
SELECT * FROM public.beta_testers;
```

### Step 4: Refresh Your Dashboard

1. Go to http://localhost:5174/admin/dashboard
2. Click the **Refresh** button
3. Your registrations should now appear!

## Troubleshooting

**Still seeing the schema cache error?**
- This means the `beta_testers` table doesn't exist
- Run the complete SQL above to create it

**Registered but data not showing?**
- The table exists but may be empty
- Run: `SELECT COUNT(*) FROM public.beta_testers;`
- If count is 0, try registering again at http://localhost:5174/beta

**Getting "table already exists" error?**
- That's OK! The `CREATE TABLE IF NOT EXISTS` handles this
- Just continue to the next step

## Backend Updates

The following code has been updated to handle schema cache issues:

1. **AdminDashboard.tsx** - Now tries multiple approaches:
   - First attempts direct table access
   - Falls back to RPC function if schema cache fails
   - Graceful error handling with helpful messages

2. **Edge Function** (`beta-register`) - Continues to work as-is
   - Registrations are saved when you submit the form
   - Data persists even if dashboard has display issues

## Contact

If you need help with this setup, check the conversation history or contact the team.
