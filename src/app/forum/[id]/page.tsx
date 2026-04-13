"use client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

/* ── Types ── */
interface ThreadData {
  id: number;
  author_id: string;
  author_name: string;
  skill_id: number;
  skill_name: string;
  title: string;
  body: string;
  tag: string;
  is_resolved: boolean;
  upvotes: number;
  downvotes: number;
  reply_count: number;
  created_at: string;
}

interface Reply {
  id: number;
  author_id: string;
  author_name: string;
  reply_to_id: number | null;
  reply_to_name: string | null;
  body: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
}

/* ── Time ago helper ── */
function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const TAG_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  question: { bg: "#0039A622", text: "#0039A6", label: "❓ Question" },
  discussion: { bg: "#10b98122", text: "#059669", label: "💬 Discussion" },
  announcement: { bg: "#CC000022", text: "#CC0000", label: "📢 Announcement" },
};

/* ── Scroll-triggered animation hook ── */
function useScrollReveal() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observe = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("animate-visible");
              observerRef.current?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
      );
    }
    observerRef.current.observe(el);
  }, []);
  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);
  return observe;
}

/* ── Vote Button Component ── */
function VoteButtons({
  upvotes,
  downvotes,
  userVote,
  onVote,
  vertical = true,
}: {
  upvotes: number;
  downvotes: number;
  userVote: number;
  onVote: (vote: 1 | -1) => void;
  vertical?: boolean;
}) {
  const net = upvotes - downvotes;
  return (
    <div style={{
      display: "flex",
      flexDirection: vertical ? "column" : "row",
      alignItems: "center",
      gap: vertical ? 2 : 8,
    }}>
      <button
        onClick={(e) => { e.preventDefault(); onVote(1); }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: vertical ? 18 : 14,
          color: userVote === 1 ? "#059669" : "inherit",
          opacity: userVote === 1 ? 1 : 0.4,
          transition: "all 0.2s",
          fontWeight: userVote === 1 ? 900 : 400,
          padding: 2,
        }}
        title="Upvote"
      >▲</button>
      <span style={{
        fontSize: vertical ? 18 : 14,
        fontWeight: 800,
        color: net > 0 ? "#059669" : net < 0 ? "#CC0000" : "inherit",
        minWidth: vertical ? undefined : 20,
        textAlign: "center",
      }}>{net}</span>
      <button
        onClick={(e) => { e.preventDefault(); onVote(-1); }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: vertical ? 18 : 14,
          color: userVote === -1 ? "#CC0000" : "inherit",
          opacity: userVote === -1 ? 1 : 0.4,
          transition: "all 0.2s",
          fontWeight: userVote === -1 ? 900 : 400,
          padding: 2,
        }}
        title="Downvote"
      >▼</button>
    </div>
  );
}

export default function ForumThreadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const threadId = params.id as string;
  const observe = useScrollReveal();

  const [thread, setThread] = useState<ThreadData | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [loadingData, setLoadingData] = useState(true);

  // Reply form
  const [replyBody, setReplyBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Fetch thread + replies
  const fetchThread = useCallback(async () => {
    if (!user) return;
    const params = new URLSearchParams({ user_id: user.id });
    const res = await fetch(`/api/forum/${threadId}?${params}`);
    const data = await res.json();
    if (data.thread) {
      setThread(data.thread);
      setReplies(data.replies || []);
      setUserVotes(data.userVotes || {});
    }
    setLoadingData(false);
  }, [user, threadId]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  // Vote handler
  async function handleVote(targetType: "thread" | "reply", targetId: number, vote: 1 | -1) {
    if (!user) return;
    const res = await fetch("/api/forum/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, target_type: targetType, target_id: targetId, vote }),
    });
    const data = await res.json();
    if (typeof data.userVote === "number") {
      setUserVotes((prev) => ({
        ...prev,
        [`${targetType}_${targetId}`]: data.userVote,
      }));
      // Refresh thread to get updated counts
      fetchThread();
    }
  }

  // Submit reply
  async function handleReply() {
    if (!user || !replyBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/forum/${threadId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_id: user.id,
          body: replyBody.trim(),
          reply_to_id: replyTo?.id || null,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setReplyBody("");
        setReplyTo(null);
        fetchThread();
      }
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  }

  // Toggle resolved
  async function handleToggleResolved() {
    if (!user || !thread || thread.author_id !== user.id) return;
    await fetch(`/api/forum/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author_id: user.id, is_resolved: !thread.is_resolved }),
    });
    fetchThread();
  }

  // Click "reply to" on a specific reply
  function handleReplyTo(reply: Reply) {
    setReplyTo({ id: reply.id, name: reply.author_name });
    replyInputRef.current?.focus();
    replyInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (loading || loadingData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 48, animation: "spin 1s linear infinite" }}>🐾</div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 48 }}>😿</p>
        <p style={{ fontSize: 18, fontWeight: 600 }}>Thread not found</p>
        <Link href="/forum" style={{ color: "#0039A6", textDecoration: "underline" }}>Back to Forum</Link>
      </div>
    );
  }

  if (!user) return null;

  const tag = TAG_STYLES[thread.tag] || TAG_STYLES.question;
  const isAuthor = user.id === thread.author_id;

  return (
    <div style={{ minHeight: "100vh", paddingTop: 100, paddingBottom: 60 }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px" }}>

        {/* ── Back link ── */}
        <Link href="/forum" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "#0039A6",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 14,
          marginBottom: 24,
          opacity: 0.8,
          transition: "opacity 0.2s",
        }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
        >
          ← Back to Forum
        </Link>

        {/* ── Thread Card ── */}
        <div ref={(el) => { if (el) observe(el); }} className="animate-target" style={{
          display: "flex",
          gap: 20,
          padding: 28,
          borderRadius: 20,
          border: "1px solid var(--border, #e2e8f0)",
          background: "var(--card-bg, #fff)",
          marginBottom: 32,
          opacity: 0,
          transform: "translateY(30px)",
          transition: "all 0.6s cubic-bezier(.16,1,.3,1)",
        }}>
          {/* Vote column */}
          <VoteButtons
            upvotes={thread.upvotes}
            downvotes={thread.downvotes}
            userVote={userVotes[`thread_${thread.id}`] || 0}
            onVote={(v) => handleVote("thread", thread.id, v)}
          />

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Tags row */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{
                padding: "3px 12px", borderRadius: 12,
                background: tag.bg, color: tag.text,
                fontSize: 12, fontWeight: 700,
              }}>{tag.label}</span>
              <span style={{
                padding: "3px 12px", borderRadius: 12,
                background: "#6366f122", color: "#6366f1",
                fontSize: 12, fontWeight: 600,
              }}>{thread.skill_name}</span>
              {thread.is_resolved && (
                <span style={{
                  padding: "3px 12px", borderRadius: 12,
                  background: "#10b98122", color: "#059669",
                  fontSize: 12, fontWeight: 700,
                }}>✅ Resolved</span>
              )}
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, lineHeight: 1.3 }}>
              {thread.title}
            </h1>

            <div style={{
              fontSize: 15,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              marginBottom: 16,
            }}>
              {thread.body}
            </div>

            {/* Meta row */}
            <div style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
              paddingTop: 12,
              borderTop: "1px solid var(--border, #e2e8f0)",
              fontSize: 13,
              opacity: 0.6,
            }}>
              <Link href={`/profile/${thread.author_id}`} style={{ color: "inherit", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#0039A6")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "inherit")}>
                👤 {thread.author_name}
              </Link>
              <span>🕐 {timeAgo(thread.created_at)}</span>
              <span>💬 {replies.length} {replies.length === 1 ? "reply" : "replies"}</span>

              {isAuthor && (
                <button
                  onClick={handleToggleResolved}
                  style={{
                    marginLeft: "auto",
                    padding: "6px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--border, #e2e8f0)",
                    background: thread.is_resolved ? "#10b98122" : "transparent",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 12,
                    color: thread.is_resolved ? "#059669" : "inherit",
                    transition: "all 0.2s",
                  }}
                >
                  {thread.is_resolved ? "↩️ Reopen" : "✅ Mark Resolved"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Replies Section ── */}
        <div ref={(el) => { if (el) observe(el); }} className="animate-target" style={{
          marginBottom: 32,
          opacity: 0, transform: "translateY(20px)",
          transition: "all 0.5s ease 0.1s",
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            💬 Replies ({replies.length})
          </h2>

          {replies.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: 40,
              opacity: 0.5,
              background: "var(--card-bg, #fff)",
              borderRadius: 16,
              border: "1px solid var(--border, #e2e8f0)",
            }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>🦗</p>
              <p>No replies yet. Be the first to respond!</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {replies.map((r, i) => {
                const rVote = userVotes[`reply_${r.id}`] || 0;
                return (
                  <div
                    key={r.id}
                    ref={(el) => { if (el) observe(el); }}
                    className="animate-target"
                    id={`reply-${r.id}`}
                    style={{
                      display: "flex",
                      gap: 14,
                      padding: 18,
                      borderRadius: 14,
                      border: "1px solid var(--border, #e2e8f0)",
                      background: "var(--card-bg, #fff)",
                      transition: "all 0.3s ease",
                      opacity: 0,
                      transform: "translateY(15px)",
                      transitionDelay: `${0.03 * i}s`,
                    }}
                  >
                    {/* Vote */}
                    <VoteButtons
                      upvotes={r.upvotes}
                      downvotes={r.downvotes}
                      userVote={rVote}
                      onVote={(v) => handleVote("reply", r.id, v)}
                    />

                    {/* Reply content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Reply-to indicator */}
                      {r.reply_to_id && r.reply_to_name && (
                        <a
                          href={`#reply-${r.reply_to_id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 10px",
                            borderRadius: 8,
                            background: "#0039A611",
                            color: "#0039A6",
                            fontSize: 12,
                            fontWeight: 600,
                            textDecoration: "none",
                            marginBottom: 8,
                            transition: "background 0.2s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#0039A622")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#0039A611")}
                        >
                          ↩ replying to {r.reply_to_name}
                        </a>
                      )}

                      <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 10 }}>
                        {r.body}
                      </div>

                      <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12, opacity: 0.5 }}>
                        <Link href={`/profile/${r.author_id}`} style={{ color: "inherit", textDecoration: "none" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#0039A6")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "inherit")}>
                          👤 {r.author_name}
                        </Link>
                        <span>🕐 {timeAgo(r.created_at)}</span>
                        <button
                          onClick={() => handleReplyTo(r)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#0039A6",
                            fontWeight: 600,
                            fontSize: 12,
                            padding: 0,
                            transition: "opacity 0.2s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                        >
                          ↩ Reply
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Reply Input ── */}
        <div ref={(el) => { if (el) observe(el); }} className="animate-target" style={{
          padding: 24,
          borderRadius: 20,
          border: "1px solid var(--border, #e2e8f0)",
          background: "var(--card-bg, #fff)",
          opacity: 0, transform: "translateY(20px)",
          transition: "all 0.5s ease 0.2s",
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            ✍️ Write a Reply
          </h3>

          {/* Reply-to badge */}
          {replyTo && (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 10,
              background: "#0039A611",
              color: "#0039A6",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
            }}>
              ↩ Replying to {replyTo.name}
              <button
                onClick={() => setReplyTo(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  color: "#0039A6",
                  opacity: 0.6,
                  padding: 0,
                  marginLeft: 4,
                }}
              >×</button>
            </div>
          )}

          <textarea
            ref={replyInputRef}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder={replyTo ? `Reply to ${replyTo.name}...` : "Share your thoughts, answer the question, or add context..."}
            maxLength={3000}
            rows={4}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--border, #e2e8f0)",
              background: "var(--input-bg, #f8fafc)",
              fontSize: 14,
              resize: "vertical",
              fontFamily: "inherit",
              marginBottom: 12,
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#0039A6")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border, #e2e8f0)")}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, opacity: 0.4 }}>
              {replyBody.length}/3000
            </span>
            <button
              disabled={submitting || !replyBody.trim()}
              onClick={handleReply}
              style={{
                padding: "10px 24px",
                borderRadius: 12,
                border: "none",
                background: !replyBody.trim() ? "#ccc" : "linear-gradient(135deg, #0039A6, #002266)",
                color: "#fff",
                cursor: !replyBody.trim() ? "not-allowed" : "pointer",
                fontWeight: 700,
                fontSize: 14,
                transition: "transform 0.2s",
              }}
              onMouseEnter={(e) => { if (replyBody.trim()) e.currentTarget.style.transform = "scale(1.05)"; }}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              {submitting ? "Posting..." : "Post Reply"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .animate-target { opacity: 0; transform: translateY(30px); }
        .animate-visible { opacity: 1 !important; transform: translateY(0) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
