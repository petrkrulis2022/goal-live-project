-- This migration refreshes PostgREST schema cache
-- by adding a comment that forces re-introspection

-- Add a comment to beta_testers table to trigger PostgREST refresh
COMMENT ON TABLE public.beta_testers IS 'Beta testing program registrations - updated at ' || now()::text;
