"use client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

/* ── constants ── */
const MATCHES_PER_WEAKNESS = 3;
const MAX_PENDING_REQUESTS = 3;

const YEAR_ORDER: Record<string, number> = {
  Freshman: 1, Sophomore: 2, Junior: 3, Senior: 4, Graduate: 5,
};

/* ── types ── */
interface TutorCard {
  userId: string;
  full_name: string;
  major: string | null;
  year: string | null;
  bio: string | null;
  level: string;            // mastered | proficient
  score: number;            // 0-99
  matchId?: string;
  matchStatus?: string;     // pending | accepted | declined
  iCanTeachThem: string[];  // bonus: what I can teach them back
}

interface CourseGroup {
  skillId: number;
  skillName: string;
  tutors: TutorCard[];
}

interface IncomingRequest {
  matchId: string;
  fromUserId: string;
  full_name: string;
  major: string | null;
  year: string | null;
  skillId: number;
  skillName: string;
  score: number;
  created_at: string;
}

interface Connection {
  matchId: string;
  otherUserId: string;
  full_name: string;
  major: string | null;
  year: string | null;
  skillId: number;
  skillName: string;
  avgRating: number | null;
  reviewCount: number;
}

export default function MatchesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [noSkills, setNoSkills] = useState(false);
  const [noWeaknesses, setNoWeaknesses] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    runMatching();
    loadIncomingRequests();
    loadConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function runMatching() {
    if (!user) return;
    setLoadingMatches(true);

    /* ─── 1. Load my skills ─── */
    const { data: rawMySkills } = await supabase
      .from("user_skills")
      .select("skill_id, level, skills(name)")
      .eq("user_id", user.id);

    if (!rawMySkills || rawMySkills.length === 0) {
      setNoSkills(true);
      setLoadingMatches(false);
      return;
    }

    const myWeaknesses = rawMySkills
      .filter((s: any) => s.level === "needs_help")
      .map((s: any) => ({ id: s.skill_id, name: (s.skills as any)?.name || "" }));

    const myStrengthIds = rawMySkills
      .filter((s: any) => s.level === "mastered" || s.level === "proficient")
      .map((s: any) => s.skill_id);

    const myStrengthNames = new Map(
      rawMySkills
        .filter((s: any) => s.level === "mastered" || s.level === "proficient")
        .map((s: any) => [s.skill_id, (s.skills as any)?.name || ""] as [number, string])
    );

    if (myWeaknesses.length === 0) {
      setNoWeaknesses(true);
      setLoadingMatches(false);
      return;
    }

    /* ─── 2. Load my profile (for major/year scoring) ─── */
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("major, year")
      .eq("id", user.id)
      .single();

    /* ─── 3. Load all other users' skills ─── */
    const { data: rawOtherSkills } = await supabase
      .from("user_skills")
      .select("user_id, skill_id, level, skills(name)")
      .neq("user_id", user.id);

    if (!rawOtherSkills || rawOtherSkills.length === 0) {
      setLoadingMatches(false);
      return;
    }

    /* ─── 4. Build per-user skill map ─── */
    type UserSkillEntry = { id: number; name: string; level: string };
    const userMap = new Map<string, { strengths: UserSkillEntry[]; weaknesses: UserSkillEntry[] }>();

    for (const sk of rawOtherSkills) {
      if (!userMap.has(sk.user_id)) {
        userMap.set(sk.user_id, { strengths: [], weaknesses: [] });
      }
      const entry = userMap.get(sk.user_id)!;
      const skillName = (sk.skills as any)?.name || "";
      if (sk.level === "mastered" || sk.level === "proficient") {
        entry.strengths.push({ id: sk.skill_id, name: skillName, level: sk.level });
      } else {
        entry.weaknesses.push({ id: sk.skill_id, name: skillName, level: sk.level });
      }
    }

    /* ─── 5. Fetch all profiles (for name, major, year, vacation) ─── */
    const otherUserIds = Array.from(userMap.keys());
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, bio, major, year, vacation_mode")
      .in("id", otherUserIds);

    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.id, p] as [string, any])
    );

    const vacationIds = new Set(
      (profiles || []).filter((p: any) => p.vacation_mode).map((p: any) => p.id)
    );

    /* ─── 6. Fetch existing matches ─── */
    const { data: existingMatches } = await supabase
      .from("matches")
      .select("id, user1_id, user2_id, skill_id, status")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    const matchLookup = new Map<string, { id: string; status: string }>();
    let myPendingCount = 0;
    for (const m of existingMatches || []) {
      const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
      const key = `${otherId}_${m.skill_id}`;
      matchLookup.set(key, { id: m.id, status: m.status });
      if (m.status === "pending" && m.user1_id === user.id) {
        myPendingCount++;
      }
    }
    setPendingCount(myPendingCount);

    const connectedOrDeclined = new Set<string>();
    for (const m of existingMatches || []) {
      if (m.status === "accepted" || m.status === "declined") {
        const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
        connectedOrDeclined.add(`${otherId}_${m.skill_id}`);
      }
    }

    /* ─── 7. Score tutors per weakness (Option A enhanced) ─── */
    const groups: CourseGroup[] = [];

    for (const weakness of myWeaknesses) {
      const candidates: TutorCard[] = [];

      for (const [userId, data] of userMap) {
        if (vacationIds.has(userId)) continue;
        if (connectedOrDeclined.has(`${userId}_${weakness.id}`)) continue;

        const theirSkill = data.strengths.find((s) => s.id === weakness.id);
        if (!theirSkill) continue;

        const prof = profileMap.get(userId);

        // Factor 1: Skill level weight (mastered > proficient)
        const levelScore = theirSkill.level === "mastered" ? 40 : 25;

        // Factor 2: Bidirectional bonus (can I teach them something back?)
        const iCanTeachThem = data.weaknesses
          .filter((w) => myStrengthIds.includes(w.id))
          .map((w) => myStrengthNames.get(w.id) || w.name);
        const bidirectionalScore = Math.min(iCanTeachThem.length, 3) * 10;

        // Factor 3: Major compatibility
        let majorScore = 0;
        if (myProfile?.major && prof?.major) {
          if (prof.major.toLowerCase() === myProfile.major.toLowerCase()) {
            majorScore = 10;
          }
        }

        // Factor 4: Year proximity
        let yearScore = 0;
        if (myProfile?.year && prof?.year) {
          const myYear = YEAR_ORDER[myProfile.year] || 0;
          const theirYear = YEAR_ORDER[prof.year] || 0;
          if (myYear > 0 && theirYear > 0) {
            const diff = Math.abs(myYear - theirYear);
            if (diff === 0) yearScore = 8;
            else if (diff === 1) yearScore = 5;
            else if (diff === 2) yearScore = 2;
          }
        }

        // Factor 5: Senior tutor bonus
        let seniorityBonus = 0;
        if (myProfile?.year && prof?.year) {
          const myYear = YEAR_ORDER[myProfile.year] || 0;
          const theirYear = YEAR_ORDER[prof.year] || 0;
          if (theirYear > myYear) seniorityBonus = 5;
        }

        const rawScore = levelScore + bidirectionalScore + majorScore + yearScore + seniorityBonus;
        const maxPossible = 40 + 30 + 10 + 8 + 5; // 93
        const normalizedScore = Math.min(Math.round((rawScore / maxPossible) * 99), 99);

        const matchKey = `${userId}_${weakness.id}`;
        const existing = matchLookup.get(matchKey);

        candidates.push({
          userId,
          full_name: prof?.full_name || "Panther Student",
          major: prof?.major || null,
          year: prof?.year || null,
          bio: prof?.bio || null,
          level: theirSkill.level,
          score: normalizedScore,
          matchId: existing?.id?.toString(),
          matchStatus: existing?.status,
          iCanTeachThem,
        });
      }

      candidates.sort((a, b) => b.score - a.score);
      const topTutors = candidates.slice(0, MATCHES_PER_WEAKNESS);

      if (topTutors.length > 0) {
        groups.push({ skillId: weakness.id, skillName: weakness.name, tutors: topTutors });
      }
    }

    setCourseGroups(groups);
    setLoadingMatches(false);
  }

  /* ─── Load incoming requests (sent TO me) ─── */
  async function loadIncomingRequests() {
    if (!user) return;

    const { data: pending } = await supabase
      .from("matches")
      .select("id, user1_id, skill_id, score, created_at, skills(name)")
      .eq("user2_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!pending || pending.length === 0) {
      setIncomingRequests([]);
      return;
    }

    const senderIds = pending.map((p: any) => p.user1_id);
    const { data: senderProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, major, year")
      .in("id", senderIds);

    const profMap = new Map(
      (senderProfiles || []).map((p: any) => [p.id, p] as [string, any])
    );

    const requests: IncomingRequest[] = pending.map((p: any) => {
      const prof = profMap.get(p.user1_id);
      return {
        matchId: p.id.toString(),
        fromUserId: p.user1_id,
        full_name: prof?.full_name || "Panther Student",
        major: prof?.major || null,
        year: prof?.year || null,
        skillId: p.skill_id,
        skillName: (p.skills as any)?.name || "Unknown Course",
        score: p.score || 0,
        created_at: p.created_at,
      };
    });

    setIncomingRequests(requests);
  }

  /* ─── Load accepted connections ─── */
  async function loadConnections() {
    if (!user) return;

    const { data: accepted } = await supabase
      .from("matches")
      .select("id, user1_id, user2_id, skill_id, skills(name)")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .eq("status", "accepted")
      .order("created_at", { ascending: false });

    if (!accepted || accepted.length === 0) {
      setConnections([]);
      return;
    }

    const otherIds = accepted.map((a: any) =>
      a.user1_id === user.id ? a.user2_id : a.user1_id
    );
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, major, year")
      .in("id", otherIds);

    const profMap = new Map(
      (profs || []).map((p: any) => [p.id, p] as [string, any])
    );

    // Load average tutor ratings for connected users
    const { data: reviews } = await supabase
      .from("reviews")
      .select("reviewee_id, rating")
      .in("reviewee_id", otherIds)
      .eq("reviewee_role", "tutor");

    const ratingMap = new Map<string, { sum: number; count: number }>();
    for (const r of reviews || []) {
      const entry = ratingMap.get(r.reviewee_id) || { sum: 0, count: 0 };
      entry.sum += r.rating;
      entry.count += 1;
      ratingMap.set(r.reviewee_id, entry);
    }

    setConnections(
      accepted.map((a: any) => {
        const otherId = a.user1_id === user.id ? a.user2_id : a.user1_id;
        const prof = profMap.get(otherId);
        const ratingEntry = ratingMap.get(otherId);
        return {
          matchId: a.id.toString(),
          otherUserId: otherId,
          full_name: prof?.full_name || "Panther Student",
          major: prof?.major || null,
          year: prof?.year || null,
          skillId: a.skill_id,
          skillName: (a.skills as any)?.name || "Unknown Course",
          avgRating: ratingEntry ? ratingEntry.sum / ratingEntry.count : null,
          reviewCount: ratingEntry?.count || 0,
        };
      })
    );
  }

  /* ─── Send match request (per course) ─── */
  async function sendMatchRequest(otherUserId: string, skillId: number) {
    if (!user) return;
    if (pendingCount >= MAX_PENDING_REQUESTS) return;

    setSending(`${otherUserId}_${skillId}`);

    const group = courseGroups.find((g) => g.skillId === skillId);
    const tutor = group?.tutors.find((t) => t.userId === otherUserId);

    const { data, error } = await supabase
      .from("matches")
      .insert({
        user1_id: user.id,
        user2_id: otherUserId,
        skill_id: skillId,
        score: tutor?.score || 0,
        status: "pending",
      })
      .select("id")
      .single();

    if (!error && data) {
      setCourseGroups((prev) =>
        prev.map((g) =>
          g.skillId === skillId
            ? {
                ...g,
                tutors: g.tutors.map((t) =>
                  t.userId === otherUserId
                    ? { ...t, matchId: data.id.toString(), matchStatus: "pending" }
                    : t
                ),
              }
            : g
        )
      );
      setPendingCount((c) => c + 1);
    }
    setSending(null);
  }

  /* ─── Accept incoming request ─── */
  async function handleAccept(matchId: string) {
    setSending(`accept_${matchId}`);
    const req = incomingRequests.find((r) => r.matchId === matchId);
    const { error } = await supabase
      .from("matches")
      .update({ status: "accepted" })
      .eq("id", matchId);

    if (!error) {
      setIncomingRequests((prev) => prev.filter((r) => r.matchId !== matchId));
      // Immediately add to connections
      if (req) {
        setConnections((prev) => [
          {
            matchId: req.matchId,
            otherUserId: req.fromUserId,
            full_name: req.full_name,
            major: req.major,
            year: req.year,
            skillId: req.skillId,
            skillName: req.skillName,
            avgRating: null,
            reviewCount: 0,
          },
          ...prev,
        ]);
      }
    }
    setSending(null);
  }

  /* ─── Decline incoming request ─── */
  async function handleDecline(matchId: string) {
    setSending(`decline_${matchId}`);
    const { error } = await supabase
      .from("matches")
      .update({ status: "declined" })
      .eq("id", matchId);

    if (!error) {
      setIncomingRequests((prev) => prev.filter((r) => r.matchId !== matchId));
    }
    setSending(null);
  }

  /* ─── Loading state ─── */
  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="animate-spin" style={{
          width: 40, height: 40,
          border: "3px solid var(--border-color)", borderTopColor: "var(--gsu-blue)", borderRadius: "50%",
        }} />
      </div>
    );
  }

  const totalTutors = courseGroups.reduce((sum, g) => sum + g.tutors.length, 0);

  return (
    <div style={{ minHeight: "100vh", padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div className="fade-in" style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, marginBottom: "0.25rem" }}>
            AI <span className="gradient-text">Matching</span> 🤝
          </h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            Smart multi-factor matching finds the best tutor for each course you need help with.
          </p>
        </div>

        {/* ─── Incoming Requests ─── */}
        {incomingRequests.length > 0 && (
          <div className="fade-in" style={{ marginBottom: "2rem" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              marginBottom: "0.75rem", paddingBottom: "0.5rem",
              borderBottom: "2px solid var(--gsu-blue)",
            }}>
              <span style={{
                padding: "0.35rem 0.75rem",
                borderRadius: "var(--radius-full)",
                background: "rgba(0,57,166,0.1)",
                color: "var(--gsu-blue)",
                fontSize: "0.8rem",
                fontWeight: 700,
              }}>
                📥 Incoming
              </span>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                Requests for You
              </h2>
              <span style={{
                marginLeft: "auto",
                padding: "0.25rem 0.6rem",
                borderRadius: "var(--radius-full)",
                background: "var(--gsu-red)",
                color: "white",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}>
                {incomingRequests.length}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {incomingRequests.map((req) => (
                <div
                  key={req.matchId}
                  className="card card-glow"
                  style={{
                    cursor: "default",
                    borderLeft: "4px solid var(--gsu-blue)",
                  }}
                >
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", flexWrap: "wrap", gap: "1rem",
                  }}>
                    {/* Requester info */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 200 }}>
                      <div className="avatar" style={{
                        width: 42, height: 42,
                        background: "linear-gradient(135deg, var(--gsu-blue), var(--gsu-red))",
                        color: "white", fontWeight: 700, fontSize: "0.9rem",
                      }}>
                        {req.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{req.full_name}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          {[req.major, req.year].filter(Boolean).join(" • ") || "Student"}
                        </div>
                      </div>
                    </div>

                    {/* Course + score */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{req.skillName}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          wants your help • {req.score} match
                        </div>
                      </div>
                    </div>

                    {/* Accept / Decline buttons */}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: "0.8rem" }}
                        onClick={() => handleAccept(req.matchId)}
                        disabled={sending === `accept_${req.matchId}`}
                      >
                        {sending === `accept_${req.matchId}` ? "..." : "✓ Accept"}
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{
                          fontSize: "0.8rem",
                          background: "rgba(204,0,0,0.08)",
                          color: "var(--gsu-red)",
                          border: "1px solid rgba(204,0,0,0.2)",
                        }}
                        onClick={() => handleDecline(req.matchId)}
                        disabled={sending === `decline_${req.matchId}`}
                      >
                        {sending === `decline_${req.matchId}` ? "..." : "✗ Decline"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Connections */}
        {connections.length > 0 && (
          <div className="fade-in card" style={{ cursor: "default", marginBottom: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                🤝 My Connections
              </h3>
              <span style={{
                background: "var(--gsu-blue)", color: "white",
                borderRadius: "999px", padding: "2px 10px",
                fontSize: "0.8rem", fontWeight: 700,
              }}>{connections.length}</span>
            </div>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {connections.map((c) => (
                <div key={c.matchId} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "0.75rem 1rem",
                  background: "var(--bg-secondary)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {c.full_name}
                      {c.avgRating !== null && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", fontSize: "0.8rem", color: "#f59e0b", fontWeight: 700 }}>
                          ★ {c.avgRating.toFixed(1)}
                          <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.75rem" }}>({c.reviewCount})</span>
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {c.skillName}
                      {c.major && ` · ${c.major}`}
                      {c.year && ` · ${c.year}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                    <button
                      onClick={() => router.push(`/chat/${c.matchId}`)}
                      style={{
                        fontSize: "0.8rem", padding: "6px 14px", borderRadius: "8px",
                        border: "1px solid var(--gsu-blue)", background: "transparent",
                        color: "var(--gsu-blue)", fontWeight: 600, cursor: "pointer",
                        transition: "var(--transition)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--gsu-blue)";
                        e.currentTarget.style.color = "white";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--gsu-blue)";
                      }}
                    >
                      💬 Chat
                    </button>
                    <button
                      onClick={() => router.push(`/sessions?partner=${c.otherUserId}&skill=${c.skillId}`)}
                      className="btn-primary"
                      style={{ fontSize: "0.8rem", padding: "6px 16px", borderRadius: "8px" }}
                    >
                      Book Session
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="fade-in fade-in-delay-1 card" style={{ cursor: "default", marginBottom: "2rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            🧠 How AI Matching Works
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            {[
              { step: "1", title: "Set Your Skills", desc: "Mark up to 4 strengths & 4 weaknesses" },
              { step: "2", title: "Multi-Factor Scoring", desc: "Skill level, major, year & bidirectional fit" },
              { step: "3", title: "Top 3 Per Course", desc: "Best tutors for each subject you need" },
            ].map((item) => (
              <div key={item.step} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "var(--gsu-blue)", color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.85rem", fontWeight: 700, flexShrink: 0,
                }}>
                  {item.step}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{item.title}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending request counter */}
        {pendingCount > 0 && (
          <div className="fade-in" style={{
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-lg)",
            background: "rgba(0,57,166,0.06)",
            border: "1px solid rgba(0,57,166,0.15)",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.875rem",
          }}>
            <span>
              📨 <strong>{pendingCount}</strong> of {MAX_PENDING_REQUESTS} pending requests used
            </span>
            {pendingCount >= MAX_PENDING_REQUESTS && (
              <span style={{ color: "var(--gsu-red)", fontWeight: 600, fontSize: "0.8rem" }}>
                Limit reached — wait for responses
              </span>
            )}
          </div>
        )}

        {/* Content */}
        {loadingMatches ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 180, borderRadius: "var(--radius-lg)" }} />
            ))}
          </div>
        ) : noSkills ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", cursor: "default" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎯</div>
            <h3 style={{ marginBottom: "0.5rem" }}>No Skills Set Up Yet</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
              Add your strengths and weaknesses to start finding matches.
            </p>
            <Link href="/profile" className="btn btn-primary">Set Up Skills →</Link>
          </div>
        ) : noWeaknesses ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", cursor: "default" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>💪</div>
            <h3 style={{ marginBottom: "0.5rem" }}>No Weaknesses Selected</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
              You&apos;ve only set strengths. Add courses you need help with to find tutors.
            </p>
            <Link href="/profile" className="btn btn-primary">Add Weaknesses →</Link>
          </div>
        ) : courseGroups.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", cursor: "default" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
            <h3 style={{ marginBottom: "0.5rem" }}>No Matches Found Yet</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
              As more students join, we&apos;ll find tutors for your courses.
            </p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="fade-in fade-in-delay-1" style={{
              display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap",
            }}>
              <div style={{
                padding: "0.5rem 1rem", borderRadius: "var(--radius-full)",
                background: "rgba(0,57,166,0.08)", fontSize: "0.85rem", fontWeight: 600,
                color: "var(--gsu-blue)",
              }}>
                📘 {courseGroups.length} course{courseGroups.length !== 1 ? "s" : ""}
              </div>
              <div style={{
                padding: "0.5rem 1rem", borderRadius: "var(--radius-full)",
                background: "rgba(22,163,74,0.08)", fontSize: "0.85rem", fontWeight: 600,
                color: "#16a34a",
              }}>
                👤 {totalTutors} tutor{totalTutors !== 1 ? "s" : ""} found
              </div>
            </div>

            {/* Course groups */}
            {courseGroups.map((group, gi) => (
              <div
                key={group.skillId}
                className={`fade-in fade-in-delay-${Math.min(gi + 2, 5)}`}
                style={{ marginBottom: "2rem" }}
              >
                {/* Course header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  marginBottom: "0.75rem", paddingBottom: "0.5rem",
                  borderBottom: "2px solid var(--gsu-red)",
                }}>
                  <span style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "var(--radius-full)",
                    background: "rgba(204,0,0,0.1)",
                    color: "var(--gsu-red)",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                  }}>
                    Need Help
                  </span>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                    {group.skillName}
                  </h2>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginLeft: "auto" }}>
                    {group.tutors.length} tutor{group.tutors.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Tutor cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {group.tutors.map((tutor) => (
                    <div
                      key={`${tutor.userId}_${group.skillId}`}
                      className="card card-glow"
                      style={{
                        cursor: "default",
                        borderLeft: `4px solid ${
                          tutor.score >= 70 ? "#16a34a"
                            : tutor.score >= 40 ? "var(--gsu-blue)"
                            : "var(--border-color)"
                        }`,
                      }}
                    >
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "flex-start", flexWrap: "wrap", gap: "1rem",
                      }}>
                        {/* Tutor info */}
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{
                            display: "flex", alignItems: "center", gap: "0.75rem",
                            marginBottom: "0.5rem",
                          }}>
                            <div className="avatar" style={{
                              width: 42, height: 42,
                              background: "linear-gradient(135deg, var(--gsu-blue), var(--gsu-red))",
                              color: "white", fontWeight: 700, fontSize: "0.9rem",
                            }}>
                              {tutor.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{tutor.full_name}</div>
                              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                {[tutor.major, tutor.year].filter(Boolean).join(" • ") || "Student"}
                              </div>
                            </div>
                          </div>

                          {/* Skill level + bidirectional badges */}
                          <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{
                              padding: "0.2rem 0.6rem",
                              borderRadius: "var(--radius-full)",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: tutor.level === "mastered"
                                ? "rgba(22,163,74,0.1)" : "rgba(0,57,166,0.08)",
                              color: tutor.level === "mastered" ? "#16a34a" : "var(--gsu-blue)",
                            }}>
                              {tutor.level === "mastered" ? "⭐ Mastered" : "✓ Proficient"}
                            </span>

                            {tutor.iCanTeachThem.length > 0 && (
                              <span style={{
                                padding: "0.2rem 0.6rem",
                                borderRadius: "var(--radius-full)",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                background: "rgba(147,51,234,0.08)",
                                color: "#9333ea",
                              }}>
                                🔄 You can teach them: {tutor.iCanTeachThem.slice(0, 2).join(", ")}
                                {tutor.iCanTeachThem.length > 2 ? ` +${tutor.iCanTeachThem.length - 2}` : ""}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Score + Action */}
                        <div style={{
                          display: "flex", flexDirection: "column",
                          alignItems: "center", gap: "0.5rem",
                        }}>
                          <div style={{
                            width: 56, height: 56, borderRadius: "50%",
                            border: `3px solid ${
                              tutor.score >= 70 ? "#16a34a"
                                : tutor.score >= 40 ? "var(--gsu-blue)"
                                : "var(--border-color)"
                            }`,
                            display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                          }}>
                            <span style={{ fontSize: "1.1rem", fontWeight: 800, lineHeight: 1 }}>
                              {tutor.score}
                            </span>
                            <span style={{ fontSize: "0.55rem", color: "var(--text-muted)" }}>match</span>
                          </div>

                          {tutor.matchStatus === "accepted" ? (
                            <Link
                              href={`/sessions?partner=${tutor.userId}&skill=${group.skillId}`}
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: "0.8rem" }}
                            >
                              Book Session
                            </Link>
                          ) : tutor.matchStatus === "pending" ? (
                            <button className="btn btn-secondary btn-sm" disabled style={{ fontSize: "0.8rem" }}>
                              Pending...
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: "0.8rem" }}
                              onClick={() => sendMatchRequest(tutor.userId, group.skillId)}
                              disabled={
                                sending === `${tutor.userId}_${group.skillId}` ||
                                pendingCount >= MAX_PENDING_REQUESTS
                              }
                              title={
                                pendingCount >= MAX_PENDING_REQUESTS
                                  ? "Max pending requests reached"
                                  : "Send connection request"
                              }
                            >
                              {sending === `${tutor.userId}_${group.skillId}` ? "..." : "Connect"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* Scoring explanation */}
        {courseGroups.length > 0 && (
          <div className="card" style={{ cursor: "default", marginTop: "1rem" }}>
            <h4 style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--text-muted)" }}>
              📊 How Scores Are Calculated
            </h4>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-muted)",
            }}>
              <div>⭐ <strong>Mastered</strong> = higher score</div>
              <div>🔄 <strong>Bidirectional</strong> = mutual benefit</div>
              <div>🎓 <strong>Same major</strong> = bonus</div>
              <div>📅 <strong>Close year</strong> = bonus</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
