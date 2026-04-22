import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    console.log(`Contact form submission from ${name} (${email})`);

    // Try Resend API first
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        console.log("Attempting to send via Resend API...");
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Goal.Live <onboarding@resend.dev>",
            to: "beer_sloth_coder@proton.me",
            reply_to: email,
            subject: `New Contact Form: ${subject}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0C2840;">New Contact Form Submission</h2>
                
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Name:</strong> ${escapeHtml(name)}</p>
                  <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
                  <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
                </div>
                
                <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #2EC5E0; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #0C2840;">Message:</h3>
                  <p style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(message)}</p>
                </div>
                
                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                  This email was sent from the Goal.Live contact form. 
                  Reply directly to this email to respond to ${escapeHtml(name)}.
                </p>
              </div>
            `,
          }),
        });

        const data = await response.json();
        console.log("Resend response:", response.status, data);

        if (response.ok) {
          console.log("✓ Email sent successfully via Resend API");
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Email sent successfully", 
              id: data.id,
              method: "resend"
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        } else {
          throw new Error(`Resend API error: ${response.status}`);
        }
      } catch (err) {
        console.error("✗ Resend API failed:", err);
        // Fall through to FormSubmit fallback
      }
    } else {
      console.log("No RESEND_API_KEY configured, using FormSubmit fallback");
    }

    // Fallback: Send via FormSubmit.co
    try {
      console.log("Attempting to send via FormSubmit.co...");
      const formData = new URLSearchParams();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("subject", subject);
      formData.append("message", message);
      formData.append("_captcha", "false");
      formData.append("_next", "https://goal.live");

      const response = await fetch(
        "https://formsubmit.co/beer_sloth_coder@proton.me",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        }
      );

      console.log("FormSubmit.co response:", response.status, response.ok);

      if (response.ok) {
        console.log("✓ Email sent successfully via FormSubmit.co");
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Email sent successfully",
            method: "formsubmit"
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      } else {
        throw new Error(`FormSubmit.co error: ${response.status}`);
      }
    } catch (err) {
      console.error("✗ FormSubmit.co failed:", err);

      // Final fallback: Log it for manual processing
      console.log("Logging contact message for manual processing:", {
        name,
        email,
        subject,
        message,
        timestamp: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Message received. We will contact you shortly.",
          method: "fallback"
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
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error: " + String(error) }),
      {
        status: 500,
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
