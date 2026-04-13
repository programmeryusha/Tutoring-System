"use client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

/* ── Types ── */
interface Skill {
  id: number;
  name: string;
  threadCount?: number;
}

interface Thread {
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
  question: { bg: "#0039A622", text: "var(--accent-link)", label: "❓ Question" },
  discussion: { bg: "#10b98122", text: "var(--accent-emerald)", label: "💬 Discussion" },
  announcement: { bg: "#CC000022", text: "var(--gsu-red-light)", label: "📢 Announcement" },
};

export default function ForumPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const observe = useScrollReveal();

  const [skills, setSkills] = useState<Skill[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedSkill, setSelectedSkill] = useState<number | null>(null);
  const [sort, setSort] = useState<"new" | "top" | "unresolved">("new");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(false);

  // New thread modal
  const [showNewThread, setShowNewThread] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newSkillId, setNewSkillId] = useState<number | null>(null);
  const [newTag, setNewTag] = useState<"question" | "discussion" | "announcement">("question");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch user's skills (subjects they can see in forum)
  useEffect(() => {
    if (!user) return;
    (async () => {
      // Get user's skill_ids
      const { data: userSkills } = await supabase
        .from("user_skills")
        .select("skill_id")
        .eq("user_id", user.id);

      const skillIds = [...new Set((userSkills || []).map((us: any) => us.skill_id))];
      if (skillIds.length === 0) {
        setSkills([]);
        setLoadingData(false);
        return;
      }

      // Get skill details
      const { data: skillData } = await supabase
        .from("skills")
        .select("id, name")
        .in("id", skillIds)
        .order("name");

      // Get thread counts per skill
      const { data: countData } = await supabase
        .from("forum_threads")
        .select("skill_id")
        .in("skill_id", skillIds);

      const countMap: Record<number, number> = {};
      for (const c of countData || []) {
        countMap[c.skill_id] = (countMap[c.skill_id] || 0) + 1;
      }

      const s: Skill[] = (skillData || []).map((sk: any) => ({
        id: sk.id,
        name: sk.name,
        threadCount: countMap[sk.id] || 0,
      }));

      setSkills(s);
      setLoadingData(false);
    })();
  }, [user]);

  // Fetch threads
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingThreads(true);
      const params = new URLSearchParams();
      if (selectedSkill) params.set("skill_id", String(selectedSkill));
      params.set("sort", sort);
      params.set("page", String(page));
      if (searchDebounced) params.set("search", searchDebounced);

      const res = await fetch(`/api/forum?${params}`);
      const data = await res.json();
      setThreads(data.threads || []);
      setTotal(data.total || 0);
      setLoadingThreads(false);
    })();
  }, [user, selectedSkill, sort, page, searchDebounced]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedSkill, sort, searchDebounced]);

  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);

  async function handleCreateThread() {
    if (!user || !newSkillId || !newTitle.trim() || !newBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/forum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_id: user.id,
          skill_id: newSkillId,
          title: newTitle.trim(),
          body: newBody.trim(),
          tag: newTag,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setShowNewThread(false);
        setNewTitle("");
        setNewBody("");
        setNewTag("question");
        router.push(`/forum/${data.id}`);
      }
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  }

  if (loading || loadingData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 48, animation: "spin 1s linear infinite" }}>🐾</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", paddingTop: 100, paddingBottom: 60 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px" }}>

        {/* ── Header ── */}
        <div ref={(el) => { if (el) observe(el); }} className="animate-target" style={{
          textAlign: "center",
          marginBottom: 40,
          opacity: 0,
          transform: "translateY(30px)",
          transition: "all 0.6s cubic-bezier(.16,1,.3,1)",
        }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>
            💬 Discussion Forum
          </h1>
          <p style={{ opacity: 0.6, fontSize: 16 }}>
            Ask questions, share knowledge, and collaborate with fellow Panthers
          </p>
        </div>

        {/* ── Subject Pills ── */}
        <div ref={(el) => { if (el) observe(el); }} className="animate-target" style={{
          display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24, justifyContent: "center",
          opacity: 0, transform: "translateY(20px)", transition: "all 0.5s ease 0.1s",
        }}>
          <button
            onClick={() => setSelectedSkill(null)}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              border: "2px solid",
              borderColor: !selectedSkill ? "#0039A6" : "var(--border-color)",
              background: !selectedSkill ? "#0039A6" : "transparent",
              color: !selectedSkill ? "#fff" : "inherit",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              transition: "all 0.2s",
            }}
          >
            All Subjects
          </button>
          {skills.map((sk) => (
            <button
              key={sk.id}
              onClick={() => setSelectedSkill(sk.id)}
              style={{
                padding: "8px 16px",
                borderRadius: 20,
                border: "2px solid",
                borderColor: selectedSkill === sk.id ? "#0039A6" : "var(--border-color)",
                background: selectedSkill === sk.id ? "#0039A6" : "transparent",
                color: selectedSkill === sk.id ? "#fff" : "inherit",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 13,
                transition: "all 0.2s",
              }}
            >
              {sk.name} {sk.threadCount ? <span style={{ opacity: 0.6 }}>({sk.threadCount})</span> : null}
            </button>
          ))}
        </div>

        {skills.length === 0 && (
          <div style={{
            textAlign: "center", padding: 60, opacity: 0.6,
            background: "var(--bg-card)", borderRadius: 16,
            border: "1px solid var(--border-color)",
          }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>📚</p>
            <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No subjects yet</p>
            <p>Add some skills in your <Link href="/profile" style={{ color: "var(--accent-link)", textDecoration: "underline" }}>profile</Link> to see forum subjects.</p>
          </div>
        )}

        {skills.length > 0 && (
          <>
            {/* ── Toolbar ── */}
            <div ref={(el) => { if (el) observe(el); }} className="animate-target" style={{
              display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center",
              opacity: 0, transform: "translateY(20px)", transition: "all 0.5s ease 0.15s",
            }}>
              {/* Search */}
              <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search threads..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 36px",
                    borderRadius: 12,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              {/* Sort buttons */}
              <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", borderRadius: 12, padding: 4, border: "1px solid var(--border-color)" }}>
                {(["new", "top", "unresolved"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: sort === s ? "#0039A6" : "transparent",
                      color: sort === s ? "#fff" : "inherit",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 13,
                      textTransform: "capitalize",
                      transition: "all 0.2s",
                    }}
                  >
                    {s === "new" ? "🕐 New" : s === "top" ? "🔥 Top" : "❓ Unresolved"}
                  </button>
                ))}
              </div>

              {/* New Thread button */}
              <button
                onClick={() => {
                  setNewSkillId(selectedSkill || (skills.length === 1 ? skills[0].id : null));
                  setShowNewThread(true);
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #0039A6, #002266)",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "transform 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                ✏️ New Thread
              </button>
            </div>

            {/* ── Thread List ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {loadingThreads ? (
                <div style={{ textAlign: "center", padding: 60, opacity: 0.5 }}>
                  <div style={{ fontSize: 32, animation: "spin 1s linear infinite" }}>🐾</div>
                </div>
              ) : threads.length === 0 ? (
                <div style={{
                  textAlign: "center", padding: 60, opacity: 0.6,
                  background: "var(--bg-card)", borderRadius: 16,
                  border: "1px solid var(--border-color)",
                }}>
                  <p style={{ fontSize: 48, marginBottom: 16 }}>🦗</p>
                  <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No threads yet</p>
                  <p>Be the first to start a discussion!</p>
                </div>
              ) : (
                threads.map((t, i) => {
                  const tag = TAG_STYLES[t.tag] || TAG_STYLES.question;
                  const net = t.upvotes - t.downvotes;
                  return (
                    <Link
                      key={t.id}
                      href={`/forum/${t.id}`}
                      ref={(el) => { if (el) observe(el as unknown as HTMLElement); }}
                      className="animate-target"
                      style={{
                        display: "flex",
                        gap: 16,
                        padding: 20,
                        borderRadius: 16,
                        border: "1px solid var(--border-color)",
                        background: "var(--bg-card)",
                        textDecoration: "none",
                        color: "inherit",
                        transition: "all 0.3s ease",
                        opacity: 0,
                        transform: "translateY(20px)",
                        transitionDelay: `${0.05 * i}s`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 8px 30px rgba(0,57,166,0.12)";
                        e.currentTarget.style.borderColor = "#0039A6";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                        e.currentTarget.style.borderColor = "var(--border-color)";
                      }}
                    >
                      {/* Votes */}
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 50,
                        gap: 2,
                      }}>
                        <span style={{ fontSize: 16, opacity: 0.5 }}>▲</span>
                        <span style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: net > 0 ? "var(--accent-emerald)" : net < 0 ? "var(--gsu-red-light)" : "inherit",
                        }}>{net}</span>
                        <span style={{ fontSize: 16, opacity: 0.5 }}>▼</span>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                          <span style={{
                            padding: "2px 10px",
                            borderRadius: 12,
                            background: tag.bg,
                            color: tag.text,
                            fontSize: 11,
                            fontWeight: 700,
                          }}>{tag.label}</span>
                          <span style={{
                            padding: "2px 10px",
                            borderRadius: 12,
                            background: "#6366f122",
                            color: "var(--accent-indigo)",
                            fontSize: 11,
                            fontWeight: 600,
                          }}>{t.skill_name}</span>
                          {t.is_resolved && (
                            <span style={{
                              padding: "2px 10px",
                              borderRadius: 12,
                              background: "#10b98122",
                              color: "var(--accent-emerald)",
                              fontSize: 11,
                              fontWeight: 700,
                            }}>✅ Resolved</span>
                          )}
                        </div>
                        <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}>
                          {t.title}
                        </h3>
                        <p style={{
                          fontSize: 13,
                          opacity: 0.6,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}>
                          {t.body}
                        </p>
                        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, opacity: 0.5 }}>
                          <span>👤 {t.author_name}</span>
                          <span>💬 {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}</span>
                          <span>🕐 {timeAgo(t.created_at)}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    cursor: page <= 1 ? "not-allowed" : "pointer",
                    opacity: page <= 1 ? 0.4 : 1,
                    fontWeight: 600,
                  }}
                >← Prev</button>
                <span style={{ padding: "8px 16px", fontWeight: 600, opacity: 0.7 }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    cursor: page >= totalPages ? "not-allowed" : "pointer",
                    opacity: page >= totalPages ? 0.4 : 1,
                    fontWeight: 600,
                  }}
                >Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── New Thread Modal ── */}
      {showNewThread && (
        <div
          onClick={() => setShowNewThread(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-card)",
              borderRadius: 20,
              padding: 32,
              maxWidth: 600,
              width: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>✏️ New Thread</h2>

            {/* Subject */}
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>Subject *</span>
              <select
                value={newSkillId || ""}
                onChange={(e) => setNewSkillId(parseInt(e.target.value) || null)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  fontSize: 14,
                }}
              >
                <option value="">Select a subject…</option>
                {skills.map((sk) => (
                  <option key={sk.id} value={sk.id}>{sk.name}</option>
                ))}
              </select>
            </label>

            {/* Tag */}
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>Type</span>
              <div style={{ display: "flex", gap: 8 }}>
                {(["question", "discussion", "announcement"] as const).map((tg) => {
                  const st = TAG_STYLES[tg];
                  return (
                    <button
                      key={tg}
                      type="button"
                      onClick={() => setNewTag(tg)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 10,
                        border: `2px solid ${newTag === tg ? st.text : "var(--border-color)"}`,
                        background: newTag === tg ? st.bg : "transparent",
                        color: newTag === tg ? st.text : "inherit",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 13,
                        transition: "all 0.2s",
                      }}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </label>

            {/* Title */}
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>Title *</span>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="What's your question or topic?"
                maxLength={200}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  fontSize: 14,
                }}
              />
            </label>

            {/* Body */}
            <label style={{ display: "block", marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>Details *</span>
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Provide context, code snippets, or details..."
                maxLength={5000}
                rows={6}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  fontSize: 14,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </label>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowNewThread(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "1px solid var(--border-color)",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >Cancel</button>
              <button
                disabled={submitting || !newSkillId || !newTitle.trim() || !newBody.trim()}
                onClick={handleCreateThread}
                style={{
                  padding: "10px 24px",
                  borderRadius: 12,
                  border: "none",
                  background: (!newSkillId || !newTitle.trim() || !newBody.trim()) ? "#ccc" : "linear-gradient(135deg, #0039A6, #002266)",
                  color: "#fff",
                  cursor: (!newSkillId || !newTitle.trim() || !newBody.trim()) ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {submitting ? "Posting..." : "Post Thread"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .animate-target { opacity: 0; transform: translateY(30px); }
        .animate-visible { opacity: 1 !important; transform: translateY(0) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
