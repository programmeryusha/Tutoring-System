"use client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Message {
  id: number;
  sender_id: string;
  content: string;
  created_at: string;
}

interface MatchInfo {
  matchId: string;
  otherUserId: string;
  otherName: string;
  otherMajor: string | null;
  skillName: string;
}

export default function ChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const matchId = params.matchId as string;

  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [loadingChat, setLoadingChat] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Redirect unauthenticated
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Load match info + message history
  useEffect(() => {
    if (!user || !matchId) return;

    async function loadChat() {
      setLoadingChat(true);
      setError(null);

      // 1. Verify match exists and user is part of it
      const { data: match, error: matchErr } = await supabase
        .from("matches")
        .select("id, user1_id, user2_id, skill_id, status, skills(name)")
        .eq("id", matchId)
        .single();

      if (matchErr || !match) {
        setError("Match not found.");
        setLoadingChat(false);
        return;
      }

      if (match.status !== "accepted") {
        setError("This match hasn't been accepted yet.");
        setLoadingChat(false);
        return;
      }

      const isUser1 = match.user1_id === user!.id;
      const isUser2 = match.user2_id === user!.id;
      if (!isUser1 && !isUser2) {
        setError("You are not part of this match.");
        setLoadingChat(false);
        return;
      }

      const otherId = isUser1 ? match.user2_id : match.user1_id;

      // 2. Get other user's profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, major")
        .eq("id", otherId)
        .single();

      setMatchInfo({
        matchId: match.id.toString(),
        otherUserId: otherId,
        otherName: profile?.full_name || "Panther Student",
        otherMajor: profile?.major || null,
        skillName: (match.skills as any)?.name || "Unknown Course",
      });

      // 3. Load message history
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true })
        .limit(200);

      setMessages(msgs || []);
      setLoadingChat(false);
    }

    loadChat();
  }, [user, matchId]);

  // Real-time subscription
  useEffect(() => {
    if (!user || !matchId || !matchInfo) return;

    const channel = supabase
      .channel(`chat_${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            // Avoid duplicates (in case we already added it optimistically)
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, matchId, matchInfo]);

  // Send message
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || sendingMsg || !user || !matchId) return;

    const content = newMsg.trim();
    setNewMsg("");
    setSendingMsg(true);

    const { error } = await supabase.from("messages").insert({
      match_id: Number(matchId),
      sender_id: user.id,
      content,
    });

    if (error) {
      setNewMsg(content); // restore the message so user can retry
      console.error("Send failed:", error.message);
    }

    setSendingMsg(false);
    inputRef.current?.focus();
  }

  // Format time
  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    if (isToday) return time;
    if (isYesterday) return `Yesterday ${time}`;
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
  }

  // Group messages by date for separators
  function getDateLabel(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  }

  if (loading || loadingChat) {
    return (
      <main style={{ padding: "6rem 1.5rem 2rem", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <div className="spinner" style={{ margin: "3rem auto" }} />
        <p style={{ color: "var(--text-muted)" }}>Loading chat...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: "6rem 1.5rem 2rem", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <div className="card" style={{ cursor: "default" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⚠️</p>
          <p style={{ fontWeight: 600 }}>{error}</p>
          <Link href="/matches" className="btn-primary" style={{
            display: "inline-block", marginTop: "1rem", padding: "8px 24px",
            borderRadius: "10px", fontSize: "0.9rem", textDecoration: "none",
          }}>
            Back to Matches
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{
      padding: "5rem 0 0",
      maxWidth: 700,
      margin: "0 auto",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Chat Header */}
      <div style={{
        padding: "0.75rem 1.5rem",
        borderBottom: "1px solid var(--border-color)",
        background: "var(--bg-primary)",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        flexShrink: 0,
      }}>
        <button
          onClick={() => router.push("/matches")}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "1.25rem", padding: "4px", color: "var(--text-primary)",
          }}
          aria-label="Back to matches"
        >
          ←
        </button>

        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--gsu-blue), var(--gsu-blue-light))",
          color: "white", display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: "0.9rem", flexShrink: 0,
        }}>
          {matchInfo?.otherName?.charAt(0)?.toUpperCase() || "?"}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {matchInfo?.otherName}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {matchInfo?.skillName}
            {matchInfo?.otherMajor && ` · ${matchInfo.otherMajor}`}
          </div>
        </div>

        <Link
          href={`/sessions?partner=${matchInfo?.otherUserId}&skill=${matchInfo?.matchId}`}
          className="btn-primary"
          style={{
            fontSize: "0.75rem", padding: "6px 14px", borderRadius: "8px",
            textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          📅 Book Session
        </Link>
      </div>

      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "1rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "3rem 1rem",
            color: "var(--text-muted)",
          }}>
            <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👋</p>
            <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Start the conversation!</p>
            <p style={{ fontSize: "0.85rem" }}>
              Say hi to {matchInfo?.otherName} and start learning together.
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.sender_id === user?.id;

          // Date separator
          const prevDate = i > 0 ? getDateLabel(messages[i - 1].created_at) : null;
          const currDate = getDateLabel(msg.created_at);
          const showDateSep = currDate !== prevDate;

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div style={{
                  textAlign: "center",
                  padding: "0.75rem 0",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}>
                  {currDate}
                </div>
              )}

              <div style={{
                display: "flex",
                justifyContent: isMe ? "flex-end" : "flex-start",
                marginBottom: "0.25rem",
              }}>
                <div style={{
                  maxWidth: "75%",
                  padding: "0.6rem 1rem",
                  borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: isMe
                    ? "linear-gradient(135deg, var(--gsu-blue), var(--gsu-blue-light))"
                    : "var(--bg-secondary)",
                  color: isMe ? "white" : "var(--text-primary)",
                  border: isMe ? "none" : "1px solid var(--border-color)",
                  fontSize: "0.9rem",
                  lineHeight: 1.4,
                  wordBreak: "break-word",
                }}>
                  <div>{msg.content}</div>
                  <div style={{
                    fontSize: "0.65rem",
                    marginTop: "0.25rem",
                    opacity: 0.7,
                    textAlign: "right",
                  }}>
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form
        onSubmit={handleSend}
        style={{
          padding: "0.75rem 1.5rem",
          borderTop: "1px solid var(--border-color)",
          background: "var(--bg-primary)",
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="Type a message..."
          maxLength={2000}
          autoFocus
          style={{
            flex: 1,
            padding: "0.7rem 1rem",
            borderRadius: "24px",
            border: "1px solid var(--border-color)",
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            fontSize: "0.9rem",
            outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--gsu-blue)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border-color)")}
        />
        <button
          type="submit"
          disabled={!newMsg.trim() || sendingMsg}
          className="btn-primary"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.2rem",
            flexShrink: 0,
            opacity: !newMsg.trim() ? 0.5 : 1,
            cursor: !newMsg.trim() ? "not-allowed" : "pointer",
          }}
        >
          ➤
        </button>
      </form>
    </main>
  );
}
