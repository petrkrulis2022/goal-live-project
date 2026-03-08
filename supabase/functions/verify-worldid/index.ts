/**
 * verify-worldid — Verifies a World ID ZK proof and prevents replays.
 *
 * POST body:
 * {
 *   merkle_root:        string,   // from IDKitWidget onSuccess
 *   nullifier_hash:     string,   // from IDKitWidget onSuccess
 *   proof:              string,   // from IDKitWidget onSuccess (ABI-encoded hex)
 *   verification_level: string,   // "device" | "orb"
 *   action:             string,   // "goal-live-fund-match" | "goal-live-withdraw"
 *   wallet_address:     string,   // player's wallet (signal used in widget)
 * }
 *
 * Returns: { verified: true, nullifier_hash }
 * Errors:  400 missing fields | 409 already used | 400 verification failed
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WORLDCOIN_API = "https://developer.worldcoin.org/api/v1/verify";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      merkle_root,
      nullifier_hash,
      proof,
      verification_level,
      action,
      wallet_address,
    } = body;

    // ── Validate required fields ────────────────────────────────────────────
    if (
      !merkle_root ||
      !nullifier_hash ||
      !proof ||
      !verification_level ||
      !action ||
      !wallet_address
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate action is one of our expected values
    const VALID_ACTIONS = ["goal-live-fund-match", "goal-live-withdraw"];
    if (!VALID_ACTIONS.includes(action)) {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Anti-replay: check nullifier already used for this action ───────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existing } = await supabase
      .from("world_id_verifications")
      .select("id")
      .eq("nullifier_hash", nullifier_hash)
      .eq("action", action)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          error: "This World ID has already been used for this action. Each human can only perform this action once.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Verify proof via Worldcoin Developer Portal Cloud API ────────────────
    const appId = Deno.env.get("WORLD_APP_ID");
    if (!appId) {
      return new Response(
        JSON.stringify({ error: "WORLD_APP_ID not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const verifyRes = await fetch(`${WORLDCOIN_API}/${appId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merkle_root,
        nullifier_hash,
        proof,
        verification_level,
        action,
        signal: wallet_address,
      }),
    });

    const verifyData = await verifyRes.json();

    if (!verifyRes.ok) {
      console.error("Worldcoin verification failed:", verifyData);
      return new Response(
        JSON.stringify({
          error: verifyData.detail ?? "World ID verification failed",
          code: verifyData.code,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Store nullifier to prevent replay ───────────────────────────────────
    const { error: insertErr } = await supabase
      .from("world_id_verifications")
      .insert({
        nullifier_hash,
        action,
        wallet_address: wallet_address.toLowerCase(),
      });

    if (insertErr) {
      // Race condition: another request inserted between our check and insert
      if (insertErr.code === "23505") {
        return new Response(
          JSON.stringify({ error: "This World ID has already been used for this action." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw insertErr;
    }

    return new Response(
      JSON.stringify({ verified: true, nullifier_hash }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-worldid error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
