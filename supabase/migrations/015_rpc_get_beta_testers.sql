-- Create RPC function to bypass PostgREST schema cache issue
create or replace function get_beta_testers_list()
returns table (
  id uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  name text,
  telegram text,
  discord text,
  solana_wallet text,
  status text,
  testnet_usdc_sent boolean,
  testnet_send_date timestamp with time zone,
  testnet_amount_sent numeric,
  mainnet_winnings numeric,
  mainnet_winnings_date timestamp with time zone,
  mainnet_tx_hash text,
  feedback text,
  bugs_reported integer,
  sessions_played integer,
  total_tests_participated integer
)
language sql
stable
as $$
  select 
    id,
    created_at,
    updated_at,
    name,
    telegram,
    discord,
    solana_wallet,
    status,
    testnet_usdc_sent,
    testnet_send_date,
    testnet_amount_sent,
    mainnet_winnings,
    mainnet_winnings_date,
    mainnet_tx_hash,
    feedback,
    bugs_reported,
    sessions_played,
    total_tests_participated
  from beta_testers
  order by created_at desc;
$$;

-- Grant execute permission
grant execute on function get_beta_testers_list() to anon, authenticated, service_role;
