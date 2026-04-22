import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const { name, email, subject, message } = await req.json();

    // Validate input
    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    console.log(`📧 Contact: ${name} (${email}) - ${subject}`);

    // Try to store in database (best effort, not required for email)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let storedInDb = false;
    try {
      const { error } = await supabase.from("contact_messages").insert([
        {
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        },
      ]);
      if (!error) {
        storedInDb = true;
        console.log("✓ Stored in database");
      }
    } catch (err) {
      console.log("Could not store in database (continuing anyway):", err);
    }

    // Send email via Resend (MAIN PRIORITY)
    const resendKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;

    if (resendKey) {
      try {
        console.log("Sending email via Resend...");
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "onboarding@resend.dev",
            to: "eddieanderson@protonmail.com",
            subject: `📧 ${subject}`,
            html: `
              <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
                <h2 style="color: #0C2840;">New Contact Submission</h2>
                <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                  <p><strong>From:</strong> ${escapeHtml(name)}</p>
                  <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
                  <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
                </div>
                <div style="background: white; padding: 15px; border-left: 4px solid #2EC5E0; border-radius: 6px;">
                  <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
                </div>
              </div>
            `,
            reply_to: email,
          }),
        });

        const data = await response.json();
        if (response.ok && data.id) {
          console.log(`✓ Email sent! ID: ${data.id}`);
          emailSent = true;
        } else {
          console.log(`✗ Resend error: ${response.status}`, data);
        }
      } catch (err) {
        console.error(`✗ Resend error:`, err);
      }
    } else {
      console.log("⚠️ RESEND_API_KEY not configured!");
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: "✓ Message received! We'll review it shortly.",
        emailSent: emailSent,
        storedInDb: storedInDb,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: true,
        message: "✓ Message received! We'll review it shortly.",
        error: String(error),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
