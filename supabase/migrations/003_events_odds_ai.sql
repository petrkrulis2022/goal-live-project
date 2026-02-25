-- ── 5. GOAL EVENTS ──────────────────────────────────────────────────────────
create type goal_event_type as enum ('GOAL','VAR_OVERTURNED','VAR_CORRECTED');
create type goal_source as enum ('chainlink_cre','mock_oracle','manual');

create table goal_events (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references matches(id) on delete cascade,
  player_id       text not null,
  player_name     text not null,
  team            text not null check (team in ('home','away')),
  minute          integer not null,
  event_type      goal_event_type not null default 'GOAL',
  confirmed       boolean not null default false,
  source          goal_source not null default 'manual',
  raw_payload     jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- ── 6. PROVISIONAL CREDITS ──────────────────────────────────────────────────
create table provisional_credits (
  id                  uuid primary key default gen_random_uuid(),
  bet_id              uuid not null references bets(id) on delete cascade,
  goal_event_id       uuid references goal_events(id),
  amount              numeric(18,6) not null,
  is_final            boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ── 7. PRE-GAME ODDS (CRE-signed snapshots) ─────────────────────────────────
create table pre_game_odds (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references matches(id) on delete cascade,
  player_id      text not null,
  player_name    text,
  odds           numeric(10,4) not null,
  source         text not null default 'manual',
  cre_signature  text,
  fetched_at     timestamptz not null default now(),
  expires_at     timestamptz,
  unique (match_id, player_id)
);

-- ── 8. AI EVENT OBSERVATIONS ─────────────────────────────────────────────────
create table ai_event_observations (
  id                  uuid primary key default gen_random_uuid(),
  match_id            uuid references matches(id),
  event_type          text not null,
  bookies_locked      boolean not null default false,
  odds_before         jsonb default '{}'::jsonb,
  odds_after          jsonb default '{}'::jsonb,
  time_to_lock_ms     integer,
  locked_before_event boolean not null default false,
  observed_at         timestamptz not null default now()
);

-- ── 9. WORLD ID VERIFICATIONS ────────────────────────────────────────────────
create type worldid_action as enum ('start_session','finish_match','withdraw');

create table world_id_verifications (
  id              uuid primary key default gen_random_uuid(),
  nullifier_hash  text unique not null,
  action          worldid_action not null,
  wallet_address  text not null,
  verified_at     timestamptz not null default now()
);

-- ── indexes ──────────────────────────────────────────────────────────────────
create index on goal_events(match_id);
create index on provisional_credits(bet_id);
create index on pre_game_odds(match_id);
