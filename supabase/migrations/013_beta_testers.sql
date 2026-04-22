-- Create beta_testers table to track beta program registrations
create table if not exists beta_testers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- User info
  name text not null,
  telegram text not null,
  discord text not null,
  solana_wallet text not null unique,
  
  -- Status tracking
  status text default 'registered' check (status in ('registered', 'approved', 'denied', 'completed')),
  
  -- Testnet funding tracking
  testnet_usdc_sent boolean default false,
  testnet_send_date timestamp with time zone,
  testnet_amount_sent numeric(20, 6) default 50.0,
  
  -- Mainnet winnings tracking
  mainnet_winnings numeric(20, 6) default 0.0,
  mainnet_winnings_date timestamp with time zone,
  mainnet_tx_hash text,
  
  -- Feedback
  feedback text,
  
  -- Reporting
  bugs_reported integer default 0,
  sessions_played integer default 0,
  total_tests_participated integer default 0
);

-- Create index on wallet for quick lookups
create index if not exists idx_beta_testers_wallet on beta_testers(solana_wallet);

-- Create index on status for filtering
create index if not exists idx_beta_testers_status on beta_testers(status);

-- Create index on created_at for sorting
create index if not exists idx_beta_testers_created on beta_testers(created_at desc);

-- Enable RLS (Row Level Security)
alter table beta_testers enable row level security;

-- Policy: Allow anyone to insert their own registration
create policy "Allow anonymous insertions" on beta_testers
  for insert with check (true);

-- Policy: Allow admins to view all registrations (requires authenticated user with admin role)
create policy "Allow admins to select all" on beta_testers
  for select using (auth.role() = 'authenticated');

-- Policy: Allow users to view only their own registration (by wallet)
create policy "Allow users to view own" on beta_testers
  for select using (true);

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger update_beta_testers_updated_at before update on beta_testers
  for each row execute function update_updated_at_column();
