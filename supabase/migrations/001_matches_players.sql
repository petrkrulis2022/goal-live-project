-- ── 1. MATCHES ──────────────────────────────────────────────────────────────
create type match_status as enum ('pre-match','live','halftime','finished','cancelled');

create table matches (
  id                uuid primary key default gen_random_uuid(),
  external_match_id text unique not null,
  home_team         text not null,
  away_team         text not null,
  kickoff_at        timestamptz not null,
  status            match_status not null default 'pre-match',
  current_minute    integer not null default 0,
  score_home        integer not null default 0,
  score_away        integer not null default 0,
  half              smallint not null default 1 check (half in (1,2)),
  is_demo           boolean not null default false,
  oracle_address    text,
  odds_api_provider text,
  odds_api_config   jsonb default '{}'::jsonb,
  contract_address  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── 2. PLAYERS ──────────────────────────────────────────────────────────────
create table players (
  id                 uuid primary key default gen_random_uuid(),
  match_id           uuid not null references matches(id) on delete cascade,
  external_player_id text not null,
  name               text not null,
  team               text not null check (team in ('home','away')),
  jersey_number      integer,
  position           text,
  odds               numeric(10,2) not null default 1,
  updated_at         timestamptz not null default now(),
  unique (match_id, external_player_id)
);

-- ── auto-update updated_at ───────────────────────────────────────────────────
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger matches_updated_at
  before update on matches
  for each row execute function update_updated_at_column();

create trigger players_updated_at
  before update on players
  for each row execute function update_updated_at_column();

-- ── indexes ──────────────────────────────────────────────────────────────────
create index on matches(status);
create index on matches(kickoff_at);
create index on players(match_id);
