-- World ID nullifier anti-replay table
-- Stores one row per (nullifier_hash, action) pair.
-- nullifier_hash is scoped to app_id+action in the Worldcoin protocol,
-- so the same human cannot fund or withdraw more than once per action.

create table if not exists world_id_verifications (
  id               uuid        primary key default gen_random_uuid(),
  nullifier_hash   text        not null,
  action           text        not null,
  wallet_address   text        not null,
  verified_at      timestamptz not null default now(),
  -- unique per (nullifier, action) — same human cannot repeat the same action
  unique (nullifier_hash, action)
);

-- Index for fast lookup during the anti-replay check
create index if not exists world_id_verifications_nullifier_action
  on world_id_verifications (nullifier_hash, action);

-- RLS: only service-role (edge function) can insert/read
alter table world_id_verifications enable row level security;

-- No user-facing reads needed — edge function uses service key
create policy "service_role_only" on world_id_verifications
  using (false);
