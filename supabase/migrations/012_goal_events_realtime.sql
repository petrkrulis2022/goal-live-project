-- Enable Supabase Realtime for goal_events table.
-- Without this, INSERT events on goal_events are never broadcast to clients,
-- meaning onGoal() in dataService.ts never fires via the Realtime path.
-- The primary goal-detection path is now the matchChannel score-delta check,
-- but enabling Realtime here provides belt-and-suspenders coverage.
alter publication supabase_realtime add table goal_events;
