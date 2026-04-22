import { useState } from "react";
import { useNavigate } from "react-router-dom";

const NAVY = "#0C2840";
const CYAN = "#2EC5E0";

export default function ContactPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Try edge function first
      const edgeResponse = await fetch(
        "https://weryswulejhjkrmervnf.supabase.co/functions/v1/send-contact-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjEyODEsImV4cCI6MjA4NzU5NzI4MX0.fxMn2LMdoFuYAln-34WUo1uUiWjSnlSzJlDS-sepdtc`,
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            subject: formData.subject,
            message: formData.message,
          }),
        }
      );

      console.log("Edge function response:", edgeResponse.status, edgeResponse.ok);

      if (edgeResponse.ok) {
        setSubmitted(true);
        setFormData({ name: "", email: "", subject: "", message: "" });
        // Redirect after 3 seconds
        setTimeout(() => navigate("/"), 3000);
      } else {
        const errorData = await edgeResponse.text();
        console.error("Edge function error:", errorData);

        // Fallback to FormSubmit.co if edge function fails
        console.log("Falling back to FormSubmit.co...");
        const fallbackResponse = await fetch(
          "https://formsubmit.co/beer_sloth_coder@proton.me",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              name: formData.name,
              email: formData.email,
              subject: formData.subject,
              message: formData.message,
              _captcha: "false",
              _next: "https://goal.live",
            }).toString(),
          }
        );

        console.log("FormSubmit fallback response:", fallbackResponse.status, fallbackResponse.ok);

        if (fallbackResponse.ok) {
          setSubmitted(true);
          setFormData({ name: "", email: "", subject: "", message: "" });
          // Redirect after 3 seconds
          setTimeout(() => navigate("/"), 3000);
        } else {
          setError(
            "Failed to send message. Please try again or contact us on Twitter @goalLiveApp"
          );
        }
      }
    } catch (err) {
      console.error("Error submitting form:", err);
      setError(
        "An error occurred. Please try again or contact us on Twitter @goalLiveApp"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen overflow-auto flex flex-col"
      style={{
        backgroundImage: "url('/page-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: NAVY,
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between"
        style={{
          padding: "0.85rem 2rem",
          background: "rgba(227,233,236,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid rgba(46,197,224,0.25)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <img
            src="/logo movement.png"
            alt=""
            style={{ height: 40, width: "auto" }}
          />
          <div>
            <div
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(12,40,64,0.45)",
              }}
            >
              GOAL.LIVE
            </div>
            <div
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                color: NAVY,
                letterSpacing: "0.04em",
              }}
            >
              Contact
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate("/")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1.2rem",
            background: NAVY,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: "0.78rem",
            letterSpacing: "0.06em",
            cursor: "pointer",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          ← Back
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 1.5rem",
        }}
      >
        <div style={{ maxWidth: 600, width: "100%" }}>
          {!submitted ? (
            <>
              <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
                <h1
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
                    fontWeight: 700,
                    color: NAVY,
                    margin: "0 0 0.75rem",
                    lineHeight: 1.2,
                  }}
                >
                  Get In Touch
                </h1>
                <p
                  style={{
                    color: "rgba(12,40,64,0.65)",
                    fontSize: "0.95rem",
                    margin: 0,
                    lineHeight: 1.6,
                  }}
                >
                  Have a question or feedback? We'd love to hear from you. Fill
                  out the form below and we'll get back to you shortly.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                style={{
                  background: "rgba(255,255,255,0.75)",
                  border: `1px solid rgba(46,197,224,0.24)`,
                  borderRadius: 18,
                  padding: "2rem",
                  backdropFilter: "blur(8px)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: NAVY,
                      marginBottom: "0.5rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    NAME
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your name"
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      border: `1px solid rgba(12,40,64,0.15)`,
                      borderRadius: 10,
                      fontSize: "0.95rem",
                      fontFamily: "'Inter', sans-serif",
                      boxSizing: "border-box",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = CYAN)}
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor =
                        "rgba(12,40,64,0.15)")
                    }
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: NAVY,
                      marginBottom: "0.5rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    EMAIL
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      border: `1px solid rgba(12,40,64,0.15)`,
                      borderRadius: 10,
                      fontSize: "0.95rem",
                      fontFamily: "'Inter', sans-serif",
                      boxSizing: "border-box",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = CYAN)}
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor =
                        "rgba(12,40,64,0.15)")
                    }
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: NAVY,
                      marginBottom: "0.5rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    SUBJECT
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="What's this about?"
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      border: `1px solid rgba(12,40,64,0.15)`,
                      borderRadius: 10,
                      fontSize: "0.95rem",
                      fontFamily: "'Inter', sans-serif",
                      boxSizing: "border-box",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = CYAN)}
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor =
                        "rgba(12,40,64,0.15)")
                    }
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: NAVY,
                      marginBottom: "0.5rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    MESSAGE
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Your message..."
                    required
                    rows={6}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      border: `1px solid rgba(12,40,64,0.15)`,
                      borderRadius: 10,
                      fontSize: "0.95rem",
                      fontFamily: "'Inter', sans-serif",
                      boxSizing: "border-box",
                      transition: "border-color 0.2s",
                      resize: "vertical",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = CYAN)}
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor =
                        "rgba(12,40,64,0.15)")
                    }
                  />
                </div>

                {error && (
                  <div
                    style={{
                      padding: "0.75rem 1rem",
                      background: "rgba(239, 68, 68, 0.1)",
                      border: `1px solid rgba(239, 68, 68, 0.3)`,
                      borderRadius: 10,
                      color: "#dc2626",
                      fontSize: "0.85rem",
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: "0.85rem 2rem",
                    background: loading ? "rgba(46,197,224,0.5)" : CYAN,
                    color: NAVY,
                    border: "none",
                    borderRadius: 10,
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    cursor: loading ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    textTransform: "uppercase",
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) e.currentTarget.style.background = "#1fa8bb";
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) e.currentTarget.style.background = CYAN;
                  }}
                >
                  {loading ? "Sending..." : "Send Message"}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
              <h2
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: "1.8rem",
                  color: NAVY,
                  margin: "0 0 0.5rem",
                }}
              >
                Message Sent!
              </h2>
              <p
                style={{
                  color: "rgba(12,40,64,0.65)",
                  fontSize: "0.95rem",
                  lineHeight: 1.6,
                }}
              >
                Thank you for reaching out. We've received your message and will
                get back to you soon at <strong>{formData.email}</strong>.
              </p>
              <p
                style={{
                  color: "rgba(12,40,64,0.45)",
                  fontSize: "0.85rem",
                  marginTop: "1.5rem",
                }}
              >
                Redirecting to home page in 3 seconds...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
