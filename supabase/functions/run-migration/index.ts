/**
 * run-migration — one-shot DDL runner.
 * Called once to create the player_balance RPC helpers, then can be deleted.
 * Protected: only runs if the correct secret header is provided.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-migration-key",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  // Simple guard so it can't be called accidentally
  const migKey = req.headers.get("x-migration-key");
  if (migKey !== "gl-run-006") {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const sql = `
    CREATE OR REPLACE FUNCTION increment_player_deposit(p_wallet TEXT, p_amount NUMERIC)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN
      INSERT INTO player_balances (wallet_address, total_deposited, total_withdrawn, updated_at)
      VALUES (LOWER(p_wallet), p_amount, 0, NOW())
      ON CONFLICT (wallet_address)
      DO UPDATE SET total_deposited = player_balances.total_deposited + p_amount, updated_at = NOW();
    END; $$;

    CREATE OR REPLACE FUNCTION increment_player_withdrawal(p_wallet TEXT, p_amount NUMERIC)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN
      INSERT INTO player_balances (wallet_address, total_deposited, total_withdrawn, updated_at)
      VALUES (LOWER(p_wallet), 0, p_amount, NOW())
      ON CONFLICT (wallet_address)
      DO UPDATE SET total_withdrawn = player_balances.total_withdrawn + p_amount, updated_at = NOW();
    END; $$;
  `;

  // Use pgmeta-style raw SQL via the admin client
  const { error } = await supabaseAdmin.rpc("exec_sql", { sql }).catch(() => ({
    error: null,
  }));

  // Fallback: try via pg REST direct
  const pgUrl = Deno.env.get("SUPABASE_URL")!.replace("https://", "https://");
  const res = await fetch(`${pgUrl}/rest/v1/sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = res.ok ? await res.json() : await res.text();

  return new Response(
    JSON.stringify({ ok: res.ok, status: res.status, body, rpc_error: error }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
