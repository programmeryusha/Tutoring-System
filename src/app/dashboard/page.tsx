"use client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

/* ── Daily Challenge types ── */
interface DailyChallenge {
  question: string;
  options: string[];
  hint: string;
  answer: string;
  explanation: string;
  subject: string;
  difficulty: string;
}

/* ── Types ── */
interface Profile {
  full_name: string | null;
  bio: string | null;
  major: string | null;
  year: string | null;
}

interface UpcomingSession {
  id: string;
  subject: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  user1_id: string;
  user2_id: string;
  other_name?: string;
  role?: string;
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

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const observe = useScrollReveal();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<UpcomingSession[]>([]);
  const [skillCount, setSkillCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [avgTutorRating, setAvgTutorRating] = useState<number | null>(null);
  const [avgStudentRating, setAvgStudentRating] = useState<number | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  /* Daily Challenge state */
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [challengeCollapsed, setChallengeCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      setLoadingData(true);

      // Profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, bio, major, year")
        .eq("id", user!.id)
        .single();
      setProfile(prof);

      // Skills count
      const { count: sc } = await supabase
        .from("user_skills")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);
      setSkillCount(sc || 0);

      // Total matches (all statuses)
      const { count: mc } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .or(`user1_id.eq.${user!.id},user2_id.eq.${user!.id}`);
      setMatchCount(mc || 0);

      // Accepted connections
      const { count: cc } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .or(`user1_id.eq.${user!.id},user2_id.eq.${user!.id}`)
        .eq("status", "accepted");
      setConnectionsCount(cc || 0);

      // Completed sessions count + total hours
      const { data: completedSess } = await supabase
        .from("sessions")
        .select("id, duration_minutes")
        .or(`user1_id.eq.${user!.id},user2_id.eq.${user!.id}`)
        .eq("status", "completed");
      setCompletedCount(completedSess?.length || 0);
      const mins = (completedSess || []).reduce(
        (sum: number, s: any) => sum + (s.duration_minutes || 60),
        0
      );
      setTotalHours(Math.round((mins / 60) * 10) / 10);

      // Upcoming sessions (with partner names)
      const { data: upSess } = await supabase
        .from("sessions")
        .select("id, subject, scheduled_at, duration_minutes, status, user1_id, user2_id")
        .or(`user1_id.eq.${user!.id},user2_id.eq.${user!.id}`)
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(5);

      if (upSess && upSess.length > 0) {
        const otherIds = upSess.map((s: any) =>
          s.user1_id === user!.id ? s.user2_id : s.user1_id
        );
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", [...new Set(otherIds)]);
        const nameMap = new Map(
          (profs || []).map((p: any) => [p.id, p.full_name || "Panther Student"])
        );

        setSessions(
          upSess.map((s: any) => {
            const otherId = s.user1_id === user!.id ? s.user2_id : s.user1_id;
            return {
              ...s,
              other_name: nameMap.get(otherId) || "Panther Student",
              role: s.user1_id === user!.id ? "Tutoring" : "Learning from",
            };
          })
        );
      } else {
        setSessions([]);
      }

      // Average ratings (split tutor/student)
      const { data: revs } = await supabase
        .from("reviews")
        .select("rating, reviewee_role")
        .eq("reviewee_id", user!.id);

      if (revs && revs.length > 0) {
        const tutorRevs = revs.filter((r: any) => r.reviewee_role === "tutor");
        const studentRevs = revs.filter((r: any) => r.reviewee_role === "student");
        if (tutorRevs.length > 0) {
          setAvgTutorRating(
            Math.round(
              (tutorRevs.reduce((s: number, r: any) => s + r.rating, 0) / tutorRevs.length) * 10
            ) / 10
          );
        }
        if (studentRevs.length > 0) {
          setAvgStudentRating(
            Math.round(
              (studentRevs.reduce((s: number, r: any) => s + r.rating, 0) / studentRevs.length) *
                10
            ) / 10
          );
        }
      }

      // Unread messages (rough: messages in last 24h where user is not the sender)
      const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
      const { count: msgCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .neq("sender_id", user!.id)
        .gte("created_at", oneDayAgo);
      setUnreadMessages(msgCount || 0);

      setLoadingData(false);
    }

    fetchData();
  }, [user]);

  /* ── Fetch daily challenge ── */
  useEffect(() => {
    if (!user) return;

    // Check if already answered today (stored in localStorage)
    const todayKey = `daily-challenge-${new Date().toISOString().slice(0, 10)}`;
    const cached = localStorage.getItem(todayKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setChallenge(parsed.challenge);
        setSelectedAnswer(parsed.selectedAnswer || null);
        setShowExplanation(parsed.showExplanation || false);
      } catch { /* ignore */ }
      return;
    }

    setChallengeLoading(true);
    fetch("/api/practice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, mode: "daily", difficulty: "medium" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setChallenge(data);
          localStorage.setItem(todayKey, JSON.stringify({ challenge: data }));
        }
      })
      .catch(() => {})
      .finally(() => setChallengeLoading(false));
  }, [user]);

  /* Save answer state to localStorage */
  function handleChallengeAnswer(letter: string) {
    setSelectedAnswer(letter);
    setShowExplanation(true);
    const todayKey = `daily-challenge-${new Date().toISOString().slice(0, 10)}`;
    const cached = localStorage.getItem(todayKey);
    try {
      const parsed = cached ? JSON.parse(cached) : {};
      parsed.selectedAnswer = letter;
      parsed.showExplanation = true;
      localStorage.setItem(todayKey, JSON.stringify(parsed));
    } catch { /* ignore */ }
  }

  if (loading || !user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="animate-spin"
          style={{
            width: 40,
            height: 40,
            border: "3px solid var(--border-color)",
            borderTopColor: "var(--gsu-blue)",
            borderRadius: "50%",
          }}
        />
      </div>
    );
  }

  const displayName =
    profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Student";
  const greeting = getGreeting();

  const statCards = [
    { value: completedCount, label: "Sessions Done", icon: "✅", color: "#16a34a" },
    { value: `${totalHours}h`, label: "Hours Logged", icon: "⏱️", color: "var(--gsu-blue)" },
    { value: connectionsCount, label: "Connections", icon: "🤝", color: "#8b5cf6" },
    { value: skillCount, label: "Skills Added", icon: "🎯", color: "var(--gsu-red)" },
  ];

  const quickActions = [
    {
      href: "/matches",
      icon: "🤝",
      title: "Find Matches",
      desc: "AI-powered peer matching",
      color: "var(--gsu-blue)",
    },
    {
      href: "/sessions",
      icon: "📅",
      title: "Sessions",
      desc: "Book or manage sessions",
      color: "#16a34a",
    },
    {
      href: "/profile",
      icon: "👤",
      title: "Edit Profile",
      desc: "Update skills & info",
      color: "#8b5cf6",
    },
    {
      href: "/me",
      icon: "⭐",
      title: "My Reviews",
      desc: "See your ratings",
      color: "#f59e0b",
    },
  ];

  return (
    <div style={{ minHeight: "100vh", padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* ═══ Welcome Header ═══ */}
        <div ref={observe} className="animate-on-scroll" style={{ marginBottom: "2rem" }}>
          <h1
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
              fontWeight: 800,
              marginBottom: "0.25rem",
            }}
          >
            {greeting},{" "}
            <span className="gradient-text-animated">{displayName}</span> 👋
          </h1>
          <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "1.05rem" }}>
            {!profile?.major
              ? "Complete your profile to get started with AI matching."
              : "Here's your tutoring overview."}
          </p>
        </div>

        {/* ═══ Profile Completion Banner ═══ */}
        {(!profile?.major || skillCount === 0) && (
          <div
            ref={observe}
            className="animate-on-scroll"
            style={{
              padding: "1.25rem 1.5rem",
              background:
                "linear-gradient(135deg, rgba(0,57,166,0.08), rgba(204,0,0,0.05))",
              border: "1px solid rgba(0,57,166,0.15)",
              borderRadius: "var(--radius-lg)",
              marginBottom: "2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
              transition: "var(--transition)",
            }}
          >
            <div>
              <p style={{ fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                🎯 Complete your profile to unlock AI matching
              </p>
              <p
                style={{
                  color: "var(--text-muted)",
                  margin: "0.25rem 0 0",
                  fontSize: "0.9rem",
                }}
              >
                Add your skills so we can find your perfect study partner.
              </p>
            </div>
            <Link href="/profile" className="btn btn-primary btn-sm">
              Complete Profile →
            </Link>
          </div>
        )}

        {/* ═══ Stats Grid ═══ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          {statCards.map((stat, i) => (
            <div
              key={stat.label}
              ref={observe}
              className="animate-on-scroll card card-glow"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                cursor: "default",
                borderLeft: `4px solid ${stat.color}`,
                transitionDelay: `${i * 0.1}s`,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  flexShrink: 0,
                }}
              >
                {stat.icon}
              </div>
              <div>
                <div
                  style={{
                    fontSize: "1.6rem",
                    fontWeight: 800,
                    lineHeight: 1,
                    color: "var(--text-primary)",
                  }}
                >
                  {loadingData ? "—" : stat.value}
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-muted)",
                    marginTop: "0.15rem",
                  }}
                >
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ Ratings Row ═══ */}
        {(avgTutorRating !== null || avgStudentRating !== null) && (
          <div
            ref={observe}
            className="animate-on-scroll"
            style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}
          >
            {avgTutorRating !== null && (
              <div
                className="card card-glow"
                style={{
                  flex: 1,
                  minWidth: 220,
                  cursor: "default",
                  borderLeft: "4px solid #f59e0b",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <div style={{ fontSize: "1.5rem" }}>🎓</div>
                <div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    Tutor Rating
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      marginTop: "0.15rem",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.1rem" }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span
                          key={s}
                          style={{
                            color:
                              s <= Math.round(avgTutorRating)
                                ? "#f59e0b"
                                : "var(--border-color)",
                            fontSize: "1.1rem",
                          }}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <span style={{ fontWeight: 800, color: "#f59e0b", fontSize: "1.1rem" }}>
                      {avgTutorRating}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {avgStudentRating !== null && (
              <div
                className="card card-glow"
                style={{
                  flex: 1,
                  minWidth: 220,
                  cursor: "default",
                  borderLeft: "4px solid #3b82f6",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <div style={{ fontSize: "1.5rem" }}>📚</div>
                <div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    Student Rating
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      marginTop: "0.15rem",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.1rem" }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span
                          key={s}
                          style={{
                            color:
                              s <= Math.round(avgStudentRating)
                                ? "#3b82f6"
                                : "var(--border-color)",
                            fontSize: "1.1rem",
                          }}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <span style={{ fontWeight: 800, color: "#3b82f6", fontSize: "1.1rem" }}>
                      {avgStudentRating}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ Quick Actions ═══ */}
        <h3
          ref={observe}
          className="animate-on-scroll"
          style={{ marginBottom: "1rem", fontSize: "1.1rem", fontWeight: 700 }}
        >
          Quick Actions
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "1rem",
            marginBottom: "2.5rem",
          }}
        >
          {quickActions.map((action, i) => (
            <Link
              key={action.href}
              href={action.href}
              ref={observe}
              className="animate-on-scroll card card-glow"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                textDecoration: "none",
                borderLeft: `4px solid ${action.color}`,
                transitionDelay: `${i * 0.1}s`,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.3rem",
                  flexShrink: 0,
                }}
              >
                {action.icon}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {action.title}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  {action.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ═══ Upcoming Sessions ═══ */}
        <h3
          ref={observe}
          className="animate-on-scroll"
          style={{ marginBottom: "1rem", fontSize: "1.1rem", fontWeight: 700 }}
        >
          Upcoming Sessions
          {sessions.length > 0 && (
            <span
              style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                fontWeight: 400,
                marginLeft: "0.5rem",
              }}
            >
              ({sessions.length})
            </span>
          )}
        </h3>
        <div ref={observe} className="animate-on-scroll">
          {loadingData ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: 80, borderRadius: "var(--radius-lg)" }}
                />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div
              className="card"
              style={{ textAlign: "center", padding: "3rem 2rem", cursor: "default" }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📅</div>
              <p
                style={{
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: "0.5rem",
                }}
              >
                No upcoming sessions
              </p>
              <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                Find a match and book your first tutoring session!
              </p>
              <Link href="/matches" className="btn btn-primary btn-sm">
                Find Matches
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {sessions.map((session, i) => {
                const dt = new Date(session.scheduled_at);
                const isToday = dt.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={session.id}
                    ref={observe}
                    className="animate-on-scroll card card-glow"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderLeft: `4px solid ${isToday ? "#16a34a" : "var(--gsu-blue)"}`,
                      cursor: "default",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                      transitionDelay: `${i * 0.08}s`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>
                        {session.subject || "Tutoring Session"}
                      </div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--text-muted)",
                          marginTop: "0.15rem",
                        }}
                      >
                        {session.role} <strong>{session.other_name}</strong>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: "0.9rem",
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          {dt.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          {dt.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          · {session.duration_minutes}min
                        </div>
                      </div>
                      {isToday && (
                        <span className="badge badge-green" style={{ fontSize: "0.75rem" }}>
                          Today
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <Link
                href="/sessions"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-lg)",
                  color: "var(--gsu-blue-light)",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  border: "1px dashed var(--border-color)",
                  transition: "var(--transition)",
                  textDecoration: "none",
                }}
              >
                View all sessions →
              </Link>
            </div>
          )}
        </div>

        {/* ═══ Activity Summary ═══ */}
        {!loadingData && (completedCount > 0 || unreadMessages > 0) && (
          <div ref={observe} className="animate-on-scroll" style={{ marginTop: "2rem" }}>
            <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem", fontWeight: 700 }}>
              Activity
            </h3>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {unreadMessages > 0 && (
                <Link
                  href="/matches"
                  className="card card-glow"
                  style={{
                    flex: 1,
                    minWidth: 220,
                    textDecoration: "none",
                    borderLeft: "4px solid var(--gsu-red)",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <div style={{ fontSize: "1.5rem" }}>💬</div>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                      {unreadMessages} new message{unreadMessages !== 1 ? "s" : ""}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      In the last 24 hours
                    </div>
                  </div>
                </Link>
              )}
              {completedCount > 0 && (
                <Link
                  href="/me"
                  className="card card-glow"
                  style={{
                    flex: 1,
                    minWidth: 220,
                    textDecoration: "none",
                    borderLeft: "4px solid #16a34a",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <div style={{ fontSize: "1.5rem" }}>🏆</div>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                      {completedCount} session{completedCount !== 1 ? "s" : ""} completed
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {totalHours} hours of tutoring
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ═══ Daily Challenge ═══ */}
        {!loadingData && (challenge || challengeLoading) && (
          <div ref={observe} className="animate-on-scroll" style={{ marginTop: "2rem" }}>
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", cursor: "pointer" }}
              onClick={() => setChallengeCollapsed((p) => !p)}
            >
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                🎯 Daily Challenge
              </h3>
              <span style={{ fontSize: "1.2rem", color: "var(--text-muted)", transition: "transform 0.2s", transform: challengeCollapsed ? "rotate(-90deg)" : "rotate(0)" }}>
                ▾
              </span>
            </div>

            {!challengeCollapsed && (
              challengeLoading ? (
                <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
                  <div className="animate-spin" style={{ width: 32, height: 32, border: "3px solid var(--border-color)", borderTopColor: "var(--gsu-blue)", borderRadius: "50%", margin: "0 auto 0.75rem" }} />
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Generating today&apos;s challenge...</div>
                </div>
              ) : challenge ? (
                <div className="card" style={{ cursor: "default", borderLeft: "4px solid #f59e0b" }}>
                  {/* Subject & difficulty badges */}
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                    <span className="badge badge-blue" style={{ fontSize: "0.75rem" }}>{challenge.subject}</span>
                    <span className="badge" style={{
                      fontSize: "0.75rem",
                      background: challenge.difficulty === "easy" ? "rgba(22,163,74,0.15)" : challenge.difficulty === "hard" ? "rgba(220,38,38,0.15)" : "rgba(245,158,11,0.15)",
                      color: challenge.difficulty === "easy" ? "var(--accent-emerald)" : challenge.difficulty === "hard" ? "var(--gsu-red-light)" : "var(--accent-amber)",
                    }}>
                      {challenge.difficulty}
                    </span>
                  </div>

                  {/* Question */}
                  <p style={{ fontWeight: 600, fontSize: "1rem", marginBottom: "1rem", lineHeight: 1.5, color: "var(--text-primary)" }}>
                    {challenge.question}
                  </p>

                  {/* Options */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                    {challenge.options.map((opt, i) => {
                      const letter = opt.charAt(0);
                      const isSelected = selectedAnswer === letter;
                      const isCorrect = letter === challenge.answer;
                      const answered = selectedAnswer !== null;

                      let bg = "var(--bg-secondary)";
                      let border = "1px solid var(--border-color)";
                      let color = "var(--text-primary)";

                      if (answered) {
                        if (isCorrect) {
                          bg = "#dcfce7";
                          border = "1px solid #16a34a";
                          color = "#16a34a";
                        } else if (isSelected && !isCorrect) {
                          bg = "#fecaca";
                          border = "1px solid #dc2626";
                          color = "#dc2626";
                        }
                      } else if (isSelected) {
                        bg = "rgba(0, 57, 166, 0.1)";
                        border = "1px solid var(--gsu-blue)";
                      }

                      return (
                        <button
                          key={i}
                          onClick={() => !answered && handleChallengeAnswer(letter)}
                          disabled={answered}
                          style={{
                            padding: "0.65rem 1rem",
                            borderRadius: "var(--radius-md)",
                            background: bg,
                            border,
                            color,
                            fontWeight: isSelected ? 700 : 500,
                            fontSize: "0.9rem",
                            textAlign: "left",
                            cursor: answered ? "default" : "pointer",
                            transition: "var(--transition)",
                            opacity: answered && !isSelected && !isCorrect ? 0.5 : 1,
                          }}
                        >
                          {opt}
                          {answered && isCorrect && " ✓"}
                          {answered && isSelected && !isCorrect && " ✗"}
                        </button>
                      );
                    })}
                  </div>

                  {/* Hint & Explanation buttons */}
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {!selectedAnswer && (
                      <button
                        onClick={() => setShowHint((p) => !p)}
                        style={{
                          padding: "0.4rem 0.85rem",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border-color)",
                          background: showHint ? "rgba(245, 158, 11, 0.1)" : "var(--bg-secondary)",
                          color: showHint ? "#f59e0b" : "var(--text-muted)",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          transition: "var(--transition)",
                        }}
                      >
                        💡 {showHint ? "Hide Hint" : "Show Hint"}
                      </button>
                    )}
                    <Link
                      href="/progress"
                      style={{
                        padding: "0.4rem 0.85rem",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-color)",
                        background: "var(--bg-secondary)",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        textDecoration: "none",
                        transition: "var(--transition)",
                      }}
                    >
                      🎯 More Practice →
                    </Link>
                  </div>

                  {/* Hint text */}
                  {showHint && !selectedAnswer && (
                    <div style={{
                      marginTop: "0.75rem",
                      padding: "0.75rem",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(245, 158, 11, 0.08)",
                      border: "1px solid rgba(245, 158, 11, 0.2)",
                      fontSize: "0.9rem",
                      color: "var(--accent-amber)",
                    }}>
                      💡 {challenge.hint}
                    </div>
                  )}

                  {/* Explanation after answering */}
                  {showExplanation && (
                    <div style={{
                      marginTop: "0.75rem",
                      padding: "0.75rem",
                      borderRadius: "var(--radius-md)",
                      background: selectedAnswer === challenge.answer ? "rgba(22, 163, 74, 0.08)" : "rgba(220, 38, 38, 0.08)",
                      border: `1px solid ${selectedAnswer === challenge.answer ? "rgba(22, 163, 74, 0.2)" : "rgba(220, 38, 38, 0.2)"}`,
                      fontSize: "0.9rem",
                      color: "var(--text-primary)",
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
                        {selectedAnswer === challenge.answer ? "✅ Correct!" : `❌ The correct answer is ${challenge.answer}`}
                      </div>
                      {challenge.explanation}
                    </div>
                  )}
                </div>
              ) : null
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
