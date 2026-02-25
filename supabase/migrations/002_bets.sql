--- ── 3. BETS ─────────────────────────────────────────────────────────────────
create type bet_type as enum ('NEXT_GOAL_SCORER','MATCH_WINNER');
create type bet_status as enum (
  'active','provisional_win','provisional_loss',
  'settled_won','settled_lost','void'
);
create type match_winner_outcome as enum ('home','away','draw');

create table bets (
  id                    uuid primary key default gen_random_uuid(),
  bettor_wallet         text not null,
  match_id              uuid not null references matches(id) on delete restrict,
  bet_type              bet_type not null,
  original_player_id    text not null,
  current_player_id     text not null,
  outcome               match_winner_outcome,          -- only for MATCH_WINNER
  original_amount       numeric(18,6) not null,
  current_amount        numeric(18,6) not null,
  total_penalties       numeric(18,6) not null default 0,
  change_count          integer not null default 0,
  odds                  numeric(10,4) not null,
  status                bet_status not null default 'active',
  placed_at             timestamptz not null default now(),
  placed_at_minute      integer not null default 0,
  goal_window_at_placement integer,
  blockchain_bet_id     text,                          -- bytes32 betId on-chain
  blockchain_lock_tx    text,                          -- lockBet() tx hash
  blockchain_settle_tx  text,                          -- batchSettle() tx hash
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── 4. BET CHANGES ──────────────────────────────────────────────────────────
create table bet_changes (
  id              uuid primary key default gen_random_uuid(),
  bet_id          uuid not null references bets(id) on delete cascade,
  from_player_id  text not null,
  to_player_id    text not null,
  penalty_amount  numeric(18,6) not null,
  penalty_pct     numeric(8,4) not null,
  match_minute    integer not null,
  changed_at      timestamptz not null default now(),
  blockchain_tx   text
);

-- ── triggers ────────────────────────────────────────────────────────────────
create trigger bets_updated_at
  before update on bets
  for each row execute function update_updated_at_column();

-- ── indexes ──────────────────────────────────────────────────────────────────
create index on bets(bettor_wallet);
create index on bets(match_id);
create index on bets(status);
create index on bet_changes(bet_id);
