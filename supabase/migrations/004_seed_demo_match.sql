-- Seed: Manchester City vs Newcastle United — Feb 21, 2026
-- Run AFTER migrations 001-003

-- Insert match
insert into matches (
  external_match_id, home_team, away_team, kickoff_at,
  status, current_minute, score_home, score_away,
  half, is_demo
) values (
  'match_city_newcastle_20260221',
  'Man City', 'Newcastle',
  '2026-02-21T20:00:00Z',
  'finished', 90, 3, 2,
  2, true
);

-- Store match uuid for player inserts
do $$
declare
  mid uuid;
begin
  select id into mid from matches where external_match_id = 'match_city_newcastle_20260221';

  -- Man City players (home)
  insert into players (match_id, external_player_id, name, team, jersey_number, position, odds) values
    (mid, 'city_1',  'Haaland Erling',      'home', 9,  'ST',  1.52),
    (mid, 'city_2',  'Marmoush Omar',        'home', 7,  'CF',  2.40),
    (mid, 'city_3',  'Semenyo Antoine',      'home', 21, 'RW',  3.50),
    (mid, 'city_4',  'Ait-Nouri Rayan',      'home', 3,  'LB',  7.00),
    (mid, 'city_5',  'Guehi Marc',           'home', 6,  'CB',  9.00),
    (mid, 'city_6',  'Rodri',                'home', 16, 'DM',  5.50),
    (mid, 'city_7',  'Silva Bernardo',       'home', 20, 'CAM', 4.80),
    (mid, 'city_8',  'O''Reilly Nico',       'home', 25, 'CM',  6.00),
    (mid, 'city_9',  'Dias Ruben',           'home', 5,  'CB',  10.0),
    (mid, 'city_10', 'Nunes Matheus',        'home', 27, 'RB',  8.00),
    (mid, 'city_gk', 'Donnarumma Gianluigi', 'home', 1,  'GK',  80.0);

  -- Newcastle players (away)
  insert into players (match_id, external_player_id, name, team, jersey_number, position, odds) values
    (mid, 'newc_1',  'Gordon Anthony',  'away', 10, 'LW', 4.50),
    (mid, 'newc_2',  'Woltemade Nick',  'away', 37, 'CF', 3.70),
    (mid, 'newc_3',  'Elanga Anthony',  'away', 20, 'RW', 5.00),
    (mid, 'newc_4',  'Trippier Kieran', 'away', 2,  'RB', 8.00),
    (mid, 'newc_5',  'Thiaw Malick',    'away', 4,  'CB', 12.0),
    (mid, 'newc_6',  'Burn Dan',        'away', 33, 'CB', 14.0),
    (mid, 'newc_7',  'Hall Lewis',      'away', 18, 'LB', 9.00),
    (mid, 'newc_8',  'Ramsey Jacob',    'away', 8,  'CM', 7.00),
    (mid, 'newc_9',  'Willock Joe',     'away', 28, 'CM', 8.50),
    (mid, 'newc_10', 'Tonali Sandro',   'away', 7,  'CM', 7.50),
    (mid, 'newc_gk', 'Pope Nick',       'away', 1,  'GK', 80.0);

  -- Goal events (from mock goal script)
  insert into goal_events (match_id, player_id, player_name, team, minute, event_type, confirmed, source) values
    (mid, 'city_1', 'Haaland Erling',   'home', 17, 'GOAL', true, 'mock_oracle'),
    (mid, 'newc_1', 'Gordon Anthony',   'away', 38, 'GOAL', true, 'mock_oracle'),
    (mid, 'city_2', 'Marmoush Omar',    'home', 54, 'GOAL', true, 'mock_oracle'),
    (mid, 'newc_2', 'Woltemade Nick',   'away', 71, 'GOAL', true, 'mock_oracle'),
    (mid, 'city_3', 'Semenyo Antoine',  'home', 84, 'GOAL', true, 'mock_oracle');

end $$;
