"use client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

/* ═══════════ Types ═══════════ */
interface SessionRow {
  id: number;
  user1_id: string;
  user2_id: string;
  subject: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  skill_id: number | null;
}

interface ReviewRow {
  id: number;
  rating: number;
  reviewee_role: string;
  created_at: string;
  review_text: string;
}

interface SkillRow {
  skill_id: number;
  level: string;
  skills: { name: string } | null;
}

interface PracticeProblem {
  question: string;
  options: string[];
  hint: string;
  answer: string;
  explanation: string;
  subject: string;
  difficulty: string;
}

type PageTab = "analytics" | "practice";

/* ═══════════ Scroll animation ═══════════ */
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

/* ═══════════ Helpers ═══════════ */
const CHART_BLUE = "#0039A6";
const CHART_RED = "#CC0000";
const CHART_GOLD = "#f59e0b";
const CHART_PURPLE = "#8b5cf6";
const CHART_GREEN = "#16a34a";
const PIE_COLORS = [CHART_BLUE, CHART_RED, CHART_GOLD, CHART_PURPLE, CHART_GREEN, "#ec4899", "#06b6d4", "#84cc16"];

type TimeRange = "30d" | "90d" | "180d" | "all";

function getDateCutoff(range: TimeRange): Date | null {
  if (range === "all") return null;
  const now = new Date();
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 180;
  return new Date(now.getTime() - days * 86400000);
}

function weekKey(d: Date): string {
  const start = new Date(d);
  start.setDate(start.getDate() - start.getDay());
  return start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function monthKey(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/* ═══════════ Milestones ═══════════ */
interface Milestone {
  icon: string;
  title: string;
  desc: string;
  earned: boolean;
}

function computeMilestones(
  completedCount: number,
  hoursTutored: number,
  hoursLearned: number,
  reviewsGiven: number,
  has5Star: boolean,
  streak: number
): Milestone[] {
  return [
    { icon: "🎯", title: "First Session", desc: "Complete your first session", earned: completedCount >= 1 },
    { icon: "🔥", title: "5 Sessions", desc: "Complete 5 sessions", earned: completedCount >= 5 },
    { icon: "💪", title: "10 Sessions", desc: "Reach 10 completed sessions", earned: completedCount >= 10 },
    { icon: "🏆", title: "25 Sessions", desc: "Quarter-century mark!", earned: completedCount >= 25 },
    { icon: "⏱️", title: "10 Hours Tutored", desc: "Spend 10+ hours tutoring", earned: hoursTutored >= 10 },
    { icon: "📚", title: "10 Hours Learning", desc: "Spend 10+ hours learning", earned: hoursLearned >= 10 },
    { icon: "⭐", title: "5-Star Rating", desc: "Receive a 5-star review", earned: has5Star },
    { icon: "✍️", title: "First Review", desc: "Write your first review", earned: reviewsGiven >= 1 },
    { icon: "📝", title: "10 Reviews", desc: "Write 10 reviews", earned: reviewsGiven >= 10 },
    { icon: "🔥", title: "4-Week Streak", desc: "Active for 4 consecutive weeks", earned: streak >= 4 },
  ];
}

/* ═══════════ Component ═══════════ */
export default function ProgressPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const observe = useScrollReveal();

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewsGivenCount, setReviewsGivenCount] = useState(0);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("90d");
  const [groupBy, setGroupBy] = useState<"week" | "month">("week");

  /* Practice tab state */
  const [activeTab, setActiveTab] = useState<PageTab>("analytics");
  const [practiceSubject, setPracticeSubject] = useState<string>("");
  const [practiceDifficulty, setPracticeDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [currentProblem, setCurrentProblem] = useState<PracticeProblem | null>(null);
  const [practiceAnswer, setPracticeAnswer] = useState<string | null>(null);
  const [practiceShowHint, setPracticeShowHint] = useState(false);
  const [practiceShowExplanation, setPracticeShowExplanation] = useState(false);
  const [practiceHistory, setPracticeHistory] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });
  const [allSubjects, setAllSubjects] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  /* ── Fetch all raw data once ── */
  useEffect(() => {
    if (!user) return;

    async function fetchAll() {
      setLoadingData(true);

      const [sessRes, revRes, revGivenRes, skillRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, user1_id, user2_id, subject, scheduled_at, duration_minutes, status, skill_id")
          .or(`user1_id.eq.${user!.id},user2_id.eq.${user!.id}`)
          .eq("status", "completed")
          .order("scheduled_at", { ascending: true }),

        supabase
          .from("reviews")
          .select("id, rating, reviewee_role, created_at, review_text")
          .eq("reviewee_id", user!.id)
          .order("created_at", { ascending: true }),

        supabase
          .from("reviews")
          .select("*", { count: "exact", head: true })
          .eq("reviewer_id", user!.id),

        supabase
          .from("user_skills")
          .select("skill_id, level, skills(name)")
          .eq("user_id", user!.id),
      ]);

      setSessions(sessRes.data || []);
      setReviews(revRes.data || []);
      setReviewsGivenCount(revGivenRes.count || 0);
      setSkills((skillRes.data as unknown as SkillRow[]) || []);

      // Populate subject list for practice tab
      const skillNames = ((skillRes.data as unknown as SkillRow[]) || [])
        .map((s) => s.skills?.name)
        .filter(Boolean) as string[];
      setAllSubjects(skillNames.length > 0 ? skillNames : ["General Computer Science"]);

      setLoadingData(false);
    }

    fetchAll();
  }, [user]);

  /* ── Generate practice problem ── */
  async function generateProblem() {
    if (!user) return;
    setPracticeLoading(true);
    setPracticeAnswer(null);
    setPracticeShowHint(false);
    setPracticeShowExplanation(false);

    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          subject: practiceSubject || undefined,
          difficulty: practiceDifficulty,
          mode: "practice",
        }),
      });
      const data = await res.json();
      if (!data.error) {
        setCurrentProblem(data);
      }
    } catch { /* ignore */ }
    finally { setPracticeLoading(false); }
  }

  function handlePracticeAnswer(letter: string) {
    setPracticeAnswer(letter);
    setPracticeShowExplanation(true);
    setPracticeHistory((prev) => ({
      correct: prev.correct + (letter === currentProblem?.answer ? 1 : 0),
      total: prev.total + 1,
    }));
  }

  /* ── Derived data (filtered by time range) ── */
  const filtered = useMemo(() => {
    const cutoff = getDateCutoff(timeRange);
    return cutoff
      ? sessions.filter((s) => new Date(s.scheduled_at) >= cutoff)
      : sessions;
  }, [sessions, timeRange]);

  const uid = user?.id;

  /* Summary stats */
  const totalCompleted = filtered.length;
  const tutored = filtered.filter((s) => s.user1_id === uid);
  const learned = filtered.filter((s) => s.user2_id === uid);
  const hoursTutored = Math.round((tutored.reduce((a, s) => a + (s.duration_minutes || 60), 0) / 60) * 10) / 10;
  const hoursLearned = Math.round((learned.reduce((a, s) => a + (s.duration_minutes || 60), 0) / 60) * 10) / 10;
  const totalHours = Math.round((hoursTutored + hoursLearned) * 10) / 10;

  /* Sessions over time (stacked bar) */
  const sessionsOverTime = useMemo(() => {
    const map = new Map<string, { name: string; tutored: number; learned: number }>();
    const keyFn = groupBy === "week" ? weekKey : monthKey;

    filtered.forEach((s) => {
      const key = keyFn(new Date(s.scheduled_at));
      if (!map.has(key)) map.set(key, { name: key, tutored: 0, learned: 0 });
      const entry = map.get(key)!;
      if (s.user1_id === uid) entry.tutored++;
      else entry.learned++;
    });

    return Array.from(map.values());
  }, [filtered, groupBy, uid]);

  /* Cumulative hours */
  const cumulativeHours = useMemo(() => {
    let tutoredAcc = 0;
    let learnedAcc = 0;
    const keyFn = groupBy === "week" ? weekKey : monthKey;
    const map = new Map<string, { name: string; tutored: number; learned: number }>();

    filtered.forEach((s) => {
      const key = keyFn(new Date(s.scheduled_at));
      const hrs = (s.duration_minutes || 60) / 60;
      if (s.user1_id === uid) tutoredAcc += hrs;
      else learnedAcc += hrs;
      map.set(key, {
        name: key,
        tutored: Math.round(tutoredAcc * 10) / 10,
        learned: Math.round(learnedAcc * 10) / 10,
      });
    });

    return Array.from(map.values());
  }, [filtered, groupBy, uid]);

  /* Rating trend (rolling avg of last 5) */
  const ratingTrend = useMemo(() => {
    const cutoff = getDateCutoff(timeRange);
    const filteredRevs = cutoff
      ? reviews.filter((r) => new Date(r.created_at) >= cutoff)
      : reviews;

    const tutorRevs = filteredRevs.filter((r) => r.reviewee_role === "tutor");
    const studentRevs = filteredRevs.filter((r) => r.reviewee_role === "student");

    // merge into timeline
    const timeline = filteredRevs.map((r) => {
      const tutorSlice = tutorRevs.filter((t) => new Date(t.created_at) <= new Date(r.created_at));
      const studentSlice = studentRevs.filter((t) => new Date(t.created_at) <= new Date(r.created_at));

      const tutorAvg =
        tutorSlice.length > 0
          ? Math.round(
              (tutorSlice.slice(-5).reduce((a, t) => a + t.rating, 0) /
                Math.min(tutorSlice.length, 5)) *
                10
            ) / 10
          : null;

      const studentAvg =
        studentSlice.length > 0
          ? Math.round(
              (studentSlice.slice(-5).reduce((a, t) => a + t.rating, 0) /
                Math.min(studentSlice.length, 5)) *
                10
            ) / 10
          : null;

      return {
        name: new Date(r.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        tutor: tutorAvg,
        student: studentAvg,
      };
    });

    // deduplicate by name (keep last)
    const deduped = new Map<string, (typeof timeline)[0]>();
    timeline.forEach((t) => deduped.set(t.name, t));
    return Array.from(deduped.values());
  }, [reviews, timeRange]);

  /* Subject distribution */
  const subjectDist = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((s) => {
      const subj = s.subject || "Other";
      map.set(subj, (map.get(subj) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  /* Streak */
  const { currentStreak, longestStreak } = useMemo(() => {
    if (sessions.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const weekSet = new Set<string>();
    sessions.forEach((s) => {
      const d = new Date(s.scheduled_at);
      const start = new Date(d);
      start.setDate(start.getDate() - start.getDay());
      weekSet.add(start.toISOString().split("T")[0]);
    });

    const sorted = Array.from(weekSet).sort();
    let longest = 1;
    let current = 1;

    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]);
      const curr = new Date(sorted[i]);
      const diff = (curr.getTime() - prev.getTime()) / 86400000;
      if (diff <= 7) {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 1;
      }
    }

    // Check if current streak is still active (last active week within 2 weeks of now)
    const lastWeek = new Date(sorted[sorted.length - 1]);
    const now = new Date();
    const daysSinceLast = (now.getTime() - lastWeek.getTime()) / 86400000;
    if (daysSinceLast > 14) current = 0;

    return { currentStreak: current, longestStreak: longest };
  }, [sessions]);

  /* Has 5-star review */
  const has5Star = reviews.some((r) => r.rating === 5);

  /* Avg ratings */
  const avgTutor = useMemo(() => {
    const t = reviews.filter((r) => r.reviewee_role === "tutor");
    return t.length > 0
      ? Math.round((t.reduce((a, r) => a + r.rating, 0) / t.length) * 10) / 10
      : null;
  }, [reviews]);

  const avgStudent = useMemo(() => {
    const s = reviews.filter((r) => r.reviewee_role === "student");
    return s.length > 0
      ? Math.round((s.reduce((a, r) => a + r.rating, 0) / s.length) * 10) / 10
      : null;
  }, [reviews]);

  /* Milestones */
  const milestones = computeMilestones(
    sessions.length,
    hoursTutored,
    hoursLearned,
    reviewsGivenCount,
    has5Star,
    currentStreak
  );
  const earnedCount = milestones.filter((m) => m.earned).length;

  /* ── Loading / auth guard ── */
  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
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

  /* ── Custom tooltip ── */
  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-md)",
          padding: "0.5rem 0.75rem",
          fontSize: "0.8rem",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: "0.25rem", color: "var(--text-primary)" }}>
          {label}
        </div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color, display: "flex", gap: "0.5rem" }}>
            <span>{p.name}:</span>
            <span style={{ fontWeight: 700 }}>{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  /* ═══════════ Render ═══════════ */
  return (
    <div style={{ minHeight: "100vh", padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* ── Header ── */}
        <div ref={observe} className="animate-on-scroll" style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: 800, marginBottom: "0.25rem" }}>
            {activeTab === "analytics" ? "📊" : "🎯"} <span className="gradient-text-animated">{activeTab === "analytics" ? "Progress Tracker" : "Practice Problems"}</span>
          </h1>
          <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "1.05rem" }}>
            {activeTab === "analytics"
              ? "Track your tutoring journey, see trends, and earn milestones."
              : "Sharpen your skills with AI-generated practice problems."}
          </p>
        </div>

        {/* ── Tab Toggle ── */}
        <div
          ref={observe}
          className="animate-on-scroll"
          style={{
            display: "flex",
            gap: "0.25rem",
            background: "var(--bg-secondary)",
            borderRadius: "var(--radius-md)",
            padding: "0.25rem",
            marginBottom: "1.5rem",
            width: "fit-content",
          }}
        >
          {([["analytics", "📊 Analytics"], ["practice", "🎯 Practice"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "var(--radius-sm)",
                border: "none",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: "pointer",
                background: activeTab === key ? "var(--gsu-blue)" : "transparent",
                color: activeTab === key ? "#fff" : "var(--text-muted)",
                transition: "var(--transition)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Time Range & Group By ── */}
        {activeTab === "analytics" && (
        <>
        <div
          ref={observe}
          className="animate-on-scroll"
          style={{
            display: "flex",
            gap: "0.75rem",
            marginBottom: "2rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: "0.25rem", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", padding: "0.25rem" }}>
            {(["30d", "90d", "180d", "all"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                style={{
                  padding: "0.4rem 0.85rem",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  background: timeRange === r ? "var(--gsu-blue)" : "transparent",
                  color: timeRange === r ? "#fff" : "var(--text-muted)",
                  transition: "var(--transition)",
                }}
              >
                {r === "all" ? "All Time" : r}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.25rem", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", padding: "0.25rem" }}>
            {(["week", "month"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                style={{
                  padding: "0.4rem 0.85rem",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  background: groupBy === g ? "var(--gsu-blue)" : "transparent",
                  color: groupBy === g ? "#fff" : "var(--text-muted)",
                  transition: "var(--transition)",
                }}
              >
                By {g}
              </button>
            ))}
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          {[
            { icon: "✅", label: "Sessions", value: totalCompleted, color: CHART_GREEN },
            { icon: "⏱️", label: "Total Hours", value: `${totalHours}h`, color: CHART_BLUE },
            { icon: "🎓", label: "Tutored", value: `${hoursTutored}h`, color: CHART_BLUE },
            { icon: "📚", label: "Learned", value: `${hoursLearned}h`, color: CHART_RED },
            { icon: "🔥", label: "Streak", value: `${currentStreak}w`, color: CHART_GOLD },
            { icon: "🏅", label: "Badges", value: `${earnedCount}/${milestones.length}`, color: CHART_PURPLE },
          ].map((stat, i) => (
            <div
              key={stat.label}
              ref={observe}
              className="animate-on-scroll card card-glow"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                cursor: "default",
                borderLeft: `4px solid ${stat.color}`,
                transitionDelay: `${i * 0.08}s`,
              }}
            >
              <div style={{ fontSize: "1.5rem" }}>{stat.icon}</div>
              <div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, lineHeight: 1, color: "var(--text-primary)" }}>
                  {loadingData ? "—" : stat.value}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {loadingData ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 280, borderRadius: "var(--radius-lg)" }} />
            ))}
          </div>
        ) : totalCompleted === 0 && reviews.length === 0 ? (
          /* ── Empty state ── */
          <div
            ref={observe}
            className="animate-on-scroll card"
            style={{ textAlign: "center", padding: "4rem 2rem", cursor: "default" }}
          >
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📊</div>
            <h2 style={{ fontWeight: 700, marginBottom: "0.5rem" }}>No data yet</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
              Complete your first tutoring session to start tracking progress!
            </p>
            <a href="/matches" className="btn btn-primary">Find Matches</a>
          </div>
        ) : (
          <>
            {/* ── Sessions Over Time (stacked bar) ── */}
            {sessionsOverTime.length > 0 && (
              <div ref={observe} className="animate-on-scroll card" style={{ cursor: "default", marginBottom: "1.5rem" }}>
                <h3 style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "1rem" }}>
                  Sessions Over Time
                </h3>
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={sessionsOverTime} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend />
                      <Bar dataKey="tutored" name="Tutored" fill={CHART_BLUE} radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="learned" name="Learned" fill={CHART_RED} radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── Cumulative Hours (area) ── */}
            {cumulativeHours.length > 1 && (
              <div ref={observe} className="animate-on-scroll card" style={{ cursor: "default", marginBottom: "1.5rem" }}>
                <h3 style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "1rem" }}>
                  Cumulative Hours
                </h3>
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <AreaChart data={cumulativeHours}>
                      <defs>
                        <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_BLUE} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_BLUE} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_RED} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_RED} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend />
                      <Area type="monotone" dataKey="tutored" name="Tutored (hrs)" stroke={CHART_BLUE} fill="url(#gradBlue)" strokeWidth={2} />
                      <Area type="monotone" dataKey="learned" name="Learned (hrs)" stroke={CHART_RED} fill="url(#gradRed)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── Rating Trend ── */}
            {ratingTrend.length > 1 && (
              <div ref={observe} className="animate-on-scroll card" style={{ cursor: "default", marginBottom: "1.5rem" }}>
                <h3 style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "1rem" }}>
                  Rating Trend
                  <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                    (rolling avg of last 5 reviews)
                  </span>
                </h3>
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={ratingTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="tutor" name="As Tutor" stroke={CHART_GOLD} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                      <Line type="monotone" dataKey="student" name="As Student" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── Subject Distribution + Ratings side by side ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "1.5rem",
                marginBottom: "1.5rem",
              }}
            >
              {/* Subject pie */}
              {subjectDist.length > 0 && (
                <div ref={observe} className="animate-on-scroll card" style={{ cursor: "default" }}>
                  <h3 style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "1rem" }}>
                    Subject Breakdown
                  </h3>
                  <div style={{ width: "100%", height: 280 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={subjectDist}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }: { name?: string; percent?: number }) =>
                            `${(name || "").length > 12 ? (name || "").slice(0, 12) + "…" : name || ""} ${((percent || 0) * 100).toFixed(0)}%`
                          }
                          labelLine={{ strokeWidth: 1 }}
                        >
                          {subjectDist.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Ratings summary */}
              {(avgTutor !== null || avgStudent !== null) && (
                <div ref={observe} className="animate-on-scroll card" style={{ cursor: "default" }}>
                  <h3 style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "1rem" }}>
                    Your Ratings
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", padding: "1rem 0" }}>
                    {avgTutor !== null && (
                      <div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "0.5rem" }}>
                          🎓 As Tutor
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <div style={{ display: "flex", gap: "0.15rem" }}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <span key={s} style={{ fontSize: "1.5rem", color: s <= Math.round(avgTutor) ? "#f59e0b" : "var(--border-color)" }}>★</span>
                            ))}
                          </div>
                          <span style={{ fontWeight: 800, fontSize: "1.3rem", color: "#f59e0b" }}>{avgTutor}</span>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            ({reviews.filter((r) => r.reviewee_role === "tutor").length} reviews)
                          </span>
                        </div>
                        {/* Simple bar */}
                        <div style={{ marginTop: "0.5rem", height: 8, background: "var(--bg-secondary)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${(avgTutor / 5) * 100}%`, height: "100%", background: "#f59e0b", borderRadius: 4, transition: "width 0.8s ease" }} />
                        </div>
                      </div>
                    )}
                    {avgStudent !== null && (
                      <div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "0.5rem" }}>
                          📚 As Student
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <div style={{ display: "flex", gap: "0.15rem" }}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <span key={s} style={{ fontSize: "1.5rem", color: s <= Math.round(avgStudent) ? "#3b82f6" : "var(--border-color)" }}>★</span>
                            ))}
                          </div>
                          <span style={{ fontWeight: 800, fontSize: "1.3rem", color: "#3b82f6" }}>{avgStudent}</span>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            ({reviews.filter((r) => r.reviewee_role === "student").length} reviews)
                          </span>
                        </div>
                        <div style={{ marginTop: "0.5rem", height: 8, background: "var(--bg-secondary)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${(avgStudent / 5) * 100}%`, height: "100%", background: "#3b82f6", borderRadius: 4, transition: "width 0.8s ease" }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Streak info ── */}
            <div
              ref={observe}
              className="animate-on-scroll"
              style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}
            >
              <div className="card card-glow" style={{ flex: 1, minWidth: 200, cursor: "default", borderLeft: `4px solid ${CHART_GOLD}`, display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ fontSize: "2rem" }}>🔥</div>
                <div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)" }}>{currentStreak} week{currentStreak !== 1 ? "s" : ""}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Current streak</div>
                </div>
              </div>
              <div className="card card-glow" style={{ flex: 1, minWidth: 200, cursor: "default", borderLeft: `4px solid ${CHART_PURPLE}`, display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ fontSize: "2rem" }}>🏆</div>
                <div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)" }}>{longestStreak} week{longestStreak !== 1 ? "s" : ""}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Longest streak</div>
                </div>
              </div>
            </div>

            {/* ── Milestones Grid ── */}
            <div ref={observe} className="animate-on-scroll" style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "1rem" }}>
                Milestones
                <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                  ({earnedCount}/{milestones.length} earned)
                </span>
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "0.75rem",
                }}
              >
                {milestones.map((m, i) => (
                  <div
                    key={m.title}
                    ref={observe}
                    className={`animate-on-scroll card ${m.earned ? "card-glow" : ""}`}
                    style={{
                      cursor: "default",
                      opacity: m.earned ? 1 : 0.5,
                      borderLeft: m.earned ? `4px solid ${CHART_GOLD}` : "4px solid var(--border-color)",
                      transitionDelay: `${i * 0.05}s`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <div style={{ fontSize: "1.5rem", filter: m.earned ? "none" : "grayscale(1)" }}>
                        {m.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: m.earned ? "var(--text-primary)" : "var(--text-muted)" }}>
                          {m.title}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {m.desc}
                        </div>
                      </div>
                    </div>
                    {m.earned && (
                      <div style={{ position: "absolute", top: 8, right: 10, fontSize: "0.7rem", color: CHART_GREEN, fontWeight: 700 }}>
                        ✓ Earned
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        </>
        )}

        {/* ═══════════ Practice Tab ═══════════ */}
        {activeTab === "practice" && (
          <>
            {/* ── Controls ── */}
            <div ref={observe} className="animate-on-scroll card" style={{ cursor: "default", marginBottom: "1.5rem" }}>
              <h3 style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "1rem" }}>
                Generate a Problem
              </h3>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                {/* Subject selector */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                    Subject
                  </label>
                  <select
                    value={practiceSubject}
                    onChange={(e) => setPracticeSubject(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-secondary)",
                      color: "var(--text-primary)",
                      fontSize: "0.9rem",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">Random (from my skills)</option>
                    {allSubjects.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Difficulty selector */}
                <div style={{ minWidth: 160 }}>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                    Difficulty
                  </label>
                  <div style={{ display: "flex", gap: "0.25rem", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", padding: "0.25rem" }}>
                    {(["easy", "medium", "hard"] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setPracticeDifficulty(d)}
                        style={{
                          flex: 1,
                          padding: "0.4rem 0.5rem",
                          borderRadius: "var(--radius-sm)",
                          border: "none",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          textTransform: "capitalize",
                          background: practiceDifficulty === d
                            ? d === "easy" ? "#16a34a" : d === "hard" ? "#dc2626" : "var(--gsu-blue)"
                            : "transparent",
                          color: practiceDifficulty === d ? "#fff" : "var(--text-muted)",
                          transition: "var(--transition)",
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate button */}
                <button
                  onClick={generateProblem}
                  disabled={practiceLoading}
                  style={{
                    padding: "0.55rem 1.5rem",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    background: "var(--gsu-blue)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    cursor: practiceLoading ? "not-allowed" : "pointer",
                    opacity: practiceLoading ? 0.7 : 1,
                    transition: "var(--transition)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {practiceLoading ? "Generating..." : "🎲 Generate"}
                </button>
              </div>

              {/* Session score */}
              {practiceHistory.total > 0 && (
                <div style={{ marginTop: "1rem", padding: "0.5rem 0.75rem", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.85rem" }}>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                    Session Score: {practiceHistory.correct}/{practiceHistory.total}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>
                    ({Math.round((practiceHistory.correct / practiceHistory.total) * 100)}%)
                  </span>
                  <div style={{ flex: 1, height: 6, background: "var(--border-color)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      width: `${(practiceHistory.correct / practiceHistory.total) * 100}%`,
                      height: "100%",
                      background: practiceHistory.correct / practiceHistory.total >= 0.7 ? "#16a34a" : practiceHistory.correct / practiceHistory.total >= 0.4 ? "#f59e0b" : "#dc2626",
                      borderRadius: 3,
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* ── Loading ── */}
            {practiceLoading && (
              <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
                <div className="animate-spin" style={{ width: 40, height: 40, border: "3px solid var(--border-color)", borderTopColor: "var(--gsu-blue)", borderRadius: "50%", margin: "0 auto 1rem" }} />
                <div style={{ color: "var(--text-muted)" }}>Generating your practice problem...</div>
              </div>
            )}

            {/* ── Empty state ── */}
            {!practiceLoading && !currentProblem && (
              <div ref={observe} className="animate-on-scroll card" style={{ textAlign: "center", padding: "4rem 2rem", cursor: "default" }}>
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎯</div>
                <h2 style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Ready to practice?</h2>
                <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", maxWidth: 400, margin: "0 auto 1.5rem" }}>
                  Pick a subject and difficulty above, then hit Generate to get an AI-powered practice problem tailored to your courses.
                </p>
              </div>
            )}

            {/* ── Problem display ── */}
            {!practiceLoading && currentProblem && (
              <div ref={observe} className="animate-on-scroll card" style={{ cursor: "default", borderLeft: "4px solid var(--gsu-blue)" }}>
                {/* Subject & difficulty badges */}
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                  <span className="badge badge-blue" style={{ fontSize: "0.75rem" }}>{currentProblem.subject}</span>
                  <span className="badge" style={{
                    fontSize: "0.75rem",
                    background: currentProblem.difficulty === "easy" ? "rgba(22,163,74,0.15)" : currentProblem.difficulty === "hard" ? "rgba(220,38,38,0.15)" : "rgba(245,158,11,0.15)",
                    color: currentProblem.difficulty === "easy" ? "var(--accent-emerald)" : currentProblem.difficulty === "hard" ? "var(--gsu-red-light)" : "var(--accent-amber)",
                  }}>
                    {currentProblem.difficulty}
                  </span>
                  {practiceAnswer && (
                    <span className="badge" style={{
                      fontSize: "0.75rem",
                      background: practiceAnswer === currentProblem.answer ? "#dcfce7" : "#fecaca",
                      color: practiceAnswer === currentProblem.answer ? "#16a34a" : "#dc2626",
                    }}>
                      {practiceAnswer === currentProblem.answer ? "✅ Correct" : "❌ Incorrect"}
                    </span>
                  )}
                </div>

                {/* Question */}
                <p style={{ fontWeight: 600, fontSize: "1.05rem", marginBottom: "1.25rem", lineHeight: 1.55, color: "var(--text-primary)" }}>
                  {currentProblem.question}
                </p>

                {/* Options */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
                  {currentProblem.options.map((opt, i) => {
                    const letter = opt.charAt(0);
                    const isSelected = practiceAnswer === letter;
                    const isCorrect = letter === currentProblem.answer;
                    const answered = practiceAnswer !== null;

                    let bg = "var(--bg-secondary)";
                    let border = "1px solid var(--border-color)";
                    let color = "var(--text-primary)";

                    if (answered) {
                      if (isCorrect) {
                        bg = "#dcfce7"; border = "1px solid #16a34a"; color = "#16a34a";
                      } else if (isSelected && !isCorrect) {
                        bg = "#fecaca"; border = "1px solid #dc2626"; color = "#dc2626";
                      }
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => !answered && handlePracticeAnswer(letter)}
                        disabled={answered}
                        style={{
                          padding: "0.7rem 1rem",
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

                {/* Action buttons */}
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  {!practiceAnswer && (
                    <button
                      onClick={() => setPracticeShowHint((p) => !p)}
                      style={{
                        padding: "0.4rem 0.85rem",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-color)",
                        background: practiceShowHint ? "rgba(245, 158, 11, 0.1)" : "var(--bg-secondary)",
                        color: practiceShowHint ? "#f59e0b" : "var(--text-muted)",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        transition: "var(--transition)",
                      }}
                    >
                      💡 {practiceShowHint ? "Hide Hint" : "Show Hint"}
                    </button>
                  )}
                  {practiceAnswer && (
                    <button
                      onClick={generateProblem}
                      style={{
                        padding: "0.4rem 0.85rem",
                        borderRadius: "var(--radius-sm)",
                        border: "none",
                        background: "var(--gsu-blue)",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        transition: "var(--transition)",
                      }}
                    >
                      🎲 Next Problem
                    </button>
                  )}
                </div>

                {/* Hint */}
                {practiceShowHint && !practiceAnswer && (
                  <div style={{
                    marginTop: "0.75rem",
                    padding: "0.75rem",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(245, 158, 11, 0.08)",
                    border: "1px solid rgba(245, 158, 11, 0.2)",
                    fontSize: "0.9rem",
                    color: "var(--accent-amber)",
                  }}>
                    💡 {currentProblem.hint}
                  </div>
                )}

                {/* Explanation */}
                {practiceShowExplanation && (
                  <div style={{
                    marginTop: "0.75rem",
                    padding: "0.75rem",
                    borderRadius: "var(--radius-md)",
                    background: practiceAnswer === currentProblem.answer ? "rgba(22, 163, 74, 0.08)" : "rgba(220, 38, 38, 0.08)",
                    border: `1px solid ${practiceAnswer === currentProblem.answer ? "rgba(22, 163, 74, 0.2)" : "rgba(220, 38, 38, 0.2)"}`,
                    fontSize: "0.9rem",
                    color: "var(--text-primary)",
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
                      {practiceAnswer === currentProblem.answer ? "✅ Correct!" : `❌ The correct answer is ${currentProblem.answer}`}
                    </div>
                    {currentProblem.explanation}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
