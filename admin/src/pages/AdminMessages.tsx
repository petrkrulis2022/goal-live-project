import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

interface ContactMessage {
  id: string;
  created_at: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  is_read: boolean;
}

export default function AdminMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Check if user is logged in
  useEffect(() => {
    const adminWallet = localStorage.getItem("adminWallet");
    if (!adminWallet) {
      navigate("/admin");
    }
  }, [navigate]);

  // Load messages from database
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const supabaseUrl = "https://weryswulejhjkrmervnf.supabase.co";
        const supabaseAnonKey =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjEyODEsImV4cCI6MjA4NzU5NzI4MX0.fxMn2LMdoFuYAln-34WUo1uUiWjSnlSzJlDS-sepdtc";
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const { data, error: dbError } = await supabase
          .from("contact_messages")
          .select("*")
          .order("created_at", { ascending: false });

        if (dbError) {
          console.error("Error loading messages:", dbError);
          setError(
            `Could not load messages: ${dbError.message}. Make sure the contact_messages table exists.`
          );
        } else if (data) {
          setMessages(data as ContactMessage[]);
        }
      } catch (err) {
        setError(`Error: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      const supabaseUrl = "https://weryswulejhjkrmervnf.supabase.co";
      const supabaseAnonKey =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjEyODEsImV4cCI6MjA4NzU5NzI4MX0.fxMn2LMdoFuYAln-34WUo1uUiWjSnlSzJlDS-sepdtc";
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      await supabase
        .from("contact_messages")
        .update({ is_read: true })
        .eq("id", id);

      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, is_read: true } : msg))
      );
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-gradient-to-br from-gray-900 to-gray-800 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-6">Contact Messages</h1>
          <div className="text-cyan-400">Loading messages...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gradient-to-br from-gray-900 to-gray-800 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate("/admin/dashboard")}
          className="mb-6 px-4 py-2 bg-cyan-500 text-navy-900 rounded-lg font-semibold hover:bg-cyan-400"
        >
          ← Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold text-white mb-2">Contact Messages</h1>
        <p className="text-gray-400 mb-8">
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </p>

        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 mb-6 text-red-200">
            {error}
          </div>
        )}

        {messages.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
            <p className="text-gray-400 text-lg">No messages yet</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-6 rounded-lg border ${
                  msg.is_read
                    ? "bg-gray-800/50 border-gray-700"
                    : "bg-cyan-900/30 border-cyan-600"
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{msg.subject}</h3>
                    <p className="text-cyan-400">From: {msg.name}</p>
                    <p className="text-gray-400 text-sm">
                      {msg.email} •{" "}
                      {new Date(msg.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!msg.is_read && (
                      <button
                        onClick={() => markAsRead(msg.id)}
                        className="px-3 py-1 bg-cyan-500 text-navy-900 text-sm rounded font-semibold hover:bg-cyan-400"
                      >
                        Mark as Read
                      </button>
                    )}
                    {msg.is_read && (
                      <span className="text-gray-500 text-sm">✓ Read</span>
                    )}
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded p-4 border-l-4 border-cyan-500">
                  <p className="text-gray-200 whitespace-pre-wrap text-sm">
                    {msg.message}
                  </p>
                </div>

                <div className="mt-4 flex gap-2">
                  <a
                    href={`mailto:${msg.email}`}
                    className="text-cyan-400 hover:text-cyan-300 text-sm"
                  >
                    📧 Reply
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
