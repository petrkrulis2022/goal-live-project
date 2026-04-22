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

    console.log(`📧 Contact form submission from ${name} (${email})`);
    console.log(`Subject: ${subject}`);
    console.log(`Message: ${message.substring(0, 100)}...`);

    // Store in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from("contact_messages")
      .insert([
        {
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      // Even if database fails, return success to user
      return new Response(
        JSON.stringify({
          success: true,
          message: "✓ Message received! We'll review it shortly.",
          logged: true,
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

    console.log("✓ Message stored in database:", data.id);

    // Try to send admin notification email
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      try {
        console.log("Sending admin notification email...");
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Goal.Live <noreply@goal.live>",
            to: "beer_sloth_coder@proton.me",
            subject: `📧 New Contact: ${subject}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px; border-radius: 8px;">
                <h2 style="color: #0C2840; margin-top: 0;">New Contact Form Submission</h2>
                <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0;">
                  <p><strong>From:</strong> ${escapeHtml(name)}</p>
                  <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
                  <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
                </div>
                <div style="background: white; padding: 20px; border-left: 4px solid #2EC5E0; border-radius: 6px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #0C2840;">Message:</h3>
                  <p style="white-space: pre-wrap; line-height: 1.6; margin: 0;">${escapeHtml(message)}</p>
                </div>
                <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
                  <a href="http://localhost:5174/admin/messages" style="color: #2EC5E0; text-decoration: none;">View in Admin Panel</a>
                </p>
              </div>
            `,
            reply_to: email,
          }),
        });

        if (response.ok) {
          console.log("✓ Admin notification sent via Resend");
        } else {
          console.log("Admin email failed:", response.status);
        }
      } catch (err) {
        console.log("Could not send admin email:", err);
      }
    } else {
      console.log(
        "RESEND_API_KEY not configured - admin email notifications disabled",
      );
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: "✓ Message received! We'll review it shortly.",
        id: data.id,
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
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({
        success: true,
        message: "✓ Message received! We'll review it shortly.",
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
