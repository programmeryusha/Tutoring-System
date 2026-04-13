"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider";

interface Message {
  role: "user" | "assistant";
  content: string;
}

/* ── Simple markdown-ish renderer (code blocks, bold, links) ── */
function renderContent(text: string) {
  // Split by code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const code = part.replace(/```\w*\n?/g, "").replace(/```$/, "");
      return (
        <pre
          key={i}
          style={{
            background: "rgba(0,0,0,0.08)",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 12,
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            overflowX: "auto",
            margin: "8px 0",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {code.trim()}
        </pre>
      );
    }
    // Inline formatting: **bold**, `code`, newlines
    const formatted = part
      .split(/(\*\*.*?\*\*|`[^`]+`|\n)/g)
      .map((seg, j) => {
        if (seg.startsWith("**") && seg.endsWith("**")) {
          return <strong key={j}>{seg.slice(2, -2)}</strong>;
        }
        if (seg.startsWith("`") && seg.endsWith("`")) {
          return (
            <code
              key={j}
              style={{
                background: "rgba(0,0,0,0.07)",
                borderRadius: 4,
                padding: "1px 5px",
                fontSize: "0.9em",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
              }}
            >
              {seg.slice(1, -1)}
            </code>
          );
        }
        if (seg === "\n") return <br key={j} />;
        return seg;
      });
    return <span key={i}>{formatted}</span>;
  });
}

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  // Greeting message when first opened
  useEffect(() => {
    if (open && !hasGreeted && messages.length === 0) {
      setHasGreeted(true);
      setMessages([
        {
          role: "assistant",
          content:
            "Hey there! 🐾 I'm **PantherBot**, your AI study assistant.\n\nI can help you with:\n• 📚 **Academic questions** — any subject you're studying\n• 🔧 **Platform help** — how to book sessions, find matches, etc.\n• 📊 **Your stats** — ratings, sessions, progress\n• 💡 **Study tips** — strategies and techniques\n\nWhat can I help you with?",
        },
      ]);
    }
  }, [open, hasGreeted, messages.length]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !user || loading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠️ Something went wrong: ${data.error}` },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Network error. Please try again." },
      ]);
    }
    setLoading(false);
  }, [input, user, loading, messages]);

  // Don't show for non-logged-in users
  if (!user) return null;

  return (
    <>
      {/* ── Floating Button ── */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close chat" : "Open PantherBot"}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 60,
          height: 60,
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg, #0039A6, #002266)",
          color: "#fff",
          fontSize: 28,
          cursor: "pointer",
          boxShadow: "0 6px 30px rgba(0,57,166,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          transition: "all 0.3s cubic-bezier(.16,1,.3,1)",
          transform: open ? "rotate(180deg) scale(0.9)" : "scale(1)",
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.transform = "scale(1.1)";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {open ? "✕" : "🐾"}
      </button>

      {/* ── Chat Panel ── */}
      <div
        style={{
          position: "fixed",
          bottom: 96,
          right: 24,
          width: 400,
          maxWidth: "calc(100vw - 48px)",
          height: 520,
          maxHeight: "calc(100vh - 140px)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          zIndex: 9998,
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
          pointerEvents: open ? "auto" : "none",
          transition: "all 0.3s cubic-bezier(.16,1,.3,1)",
          background: "var(--card-bg, #fff)",
          border: "1px solid var(--border, #e2e8f0)",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #0039A6, #002266)",
            color: "#fff",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            🐾
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>PantherBot</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>AI Study Assistant</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {messages.length > 1 && (
              <button
                onClick={() => {
                  setMessages([]);
                  setHasGreeted(false);
                }}
                title="Clear chat"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: 8,
                  padding: "4px 10px",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                🗑️
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                animation: "chatFadeIn 0.3s ease",
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background:
                    msg.role === "user"
                      ? "linear-gradient(135deg, #0039A6, #002266)"
                      : "var(--chat-bot-bg, #f1f5f9)",
                  color: msg.role === "user" ? "#fff" : "inherit",
                  fontSize: 14,
                  lineHeight: 1.5,
                  wordBreak: "break-word",
                }}
              >
                {msg.role === "assistant" ? renderContent(msg.content) : msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: "12px 18px",
                  borderRadius: "16px 16px 16px 4px",
                  background: "var(--chat-bot-bg, #f1f5f9)",
                  display: "flex",
                  gap: 5,
                  alignItems: "center",
                }}
              >
                <span className="typing-dot" style={{ animationDelay: "0s" }} />
                <span className="typing-dot" style={{ animationDelay: "0.15s" }} />
                <span className="typing-dot" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: "12px 14px",
            borderTop: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            gap: 8,
            flexShrink: 0,
            background: "var(--card-bg, #fff)",
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask PantherBot anything..."
            disabled={loading}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid var(--border, #e2e8f0)",
              background: "var(--input-bg, #f8fafc)",
              fontSize: 14,
              outline: "none",
              fontFamily: "inherit",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#0039A6")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border, #e2e8f0)")}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              border: "none",
              background:
                !input.trim() || loading
                  ? "#ccc"
                  : "linear-gradient(135deg, #0039A6, #002266)",
              color: "#fff",
              cursor: !input.trim() || loading ? "not-allowed" : "pointer",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
              flexShrink: 0,
            }}
          >
            ↑
          </button>
        </div>
      </div>

      {/* ── Styles ── */}
      <style>{`
        @keyframes chatFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #0039A6;
          opacity: 0.4;
          animation: typingBounce 0.6s ease-in-out infinite alternate;
          display: inline-block;
        }
        @keyframes typingBounce {
          from { opacity: 0.3; transform: translateY(0); }
          to { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>
    </>
  );
}
