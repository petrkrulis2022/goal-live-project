import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, telegram, discord, solanaWallet } = await req.json();

    // Validation
    if (!name || !telegram || !discord || !solanaWallet) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if wallet already registered
    const { data: existingUser } = await supabase
      .from("beta_testers")
      .select("id")
      .eq("solana_wallet", solanaWallet)
      .single();

    if (existingUser) {
      return new Response(
        JSON.stringify({
          error: "This wallet is already registered",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert beta tester registration
    const { data, error } = await supabase
      .from("beta_testers")
      .insert([
        {
          name: name.trim(),
          telegram: telegram.trim(),
          discord: discord.trim(),
          solana_wallet: solanaWallet.trim(),
          status: "registered",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to register. Please try again.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log registration (for internal tracking)
    console.log(`Beta tester registered: ${data.id}`, {
      name: data.name,
      telegram: data.telegram,
      discord: data.discord,
      wallet: data.solana_wallet,
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Registration successful!",
        id: data.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
