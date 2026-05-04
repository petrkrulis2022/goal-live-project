-- Add 'statsperform' to goal_source enum so sync-match-status can insert
-- goal_events correctly. Previously all SP goal inserts failed silently with
-- "invalid input value for enum goal_source: 'statsperform'".
alter type goal_source add value if not exists 'statsperform';
