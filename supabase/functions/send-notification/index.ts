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
    const { registrationId, name, telegram, discord, wallet } = await req.json();

    // Validation
    if (!registrationId || !name) {
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

    // Log notification
    console.log(`Sending notification to ${name}:`, {
      registrationId,
      telegram,
      discord,
      wallet: wallet.substring(0, 8) + "...",
      timestamp: new Date().toISOString(),
    });

    // In production, this would integrate with:
    // - Telegram Bot API to send DM
    // - Discord Bot API to send DM
    // - Email service (SendGrid, Mailgun, etc.)
    // - SMS service (Twilio, etc.)

    // For now, we just log it and mark as sent in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Update notification status in database (if table exists)
    try {
      const { error: updateError } = await supabase
        .from("beta_testers")
        .update({
          testnet_usdc_sent: true,
          testnet_send_date: new Date().toISOString(),
        })
        .eq("id", registrationId);

      if (updateError && !updateError.message.includes("does not exist")) {
        console.error("Update error:", updateError);
      }
    } catch (err) {
      console.log("Could not update database (table may not exist yet)");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notification sent to ${name}`,
        notifiedChannels: {
          telegram: !!telegram,
          discord: !!discord,
          email: false, // Add email later
        },
        timestamp: new Date().toISOString(),
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
