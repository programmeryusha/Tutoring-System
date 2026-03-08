"use client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface MatchedUser {
  id: string;
  full_name: string;
  bio: string | null;
  major: string | null;
  year: string | null;
  matchScore: number;
  theyCanTeach: string[];   // their strengths that match my weaknesses
  iCanTeach: string[];      // my strengths that match their weaknesses
  matchId?: string;
  matchStatus?: string;
}

export default function MatchesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<MatchedUser[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [noSkills, setNoSkills] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    runMatching();
  }, [user]);

  async function runMatching() {
    if (!user) return;
    setLoadingMatches(true);

    // 1. Get my skills
    const { data: mySkills } = await supabase
      .from("user_skills")
      .select("skill_id, is_strength, skills(name)")
      .eq("user_id", user.id);

    if (!mySkills || mySkills.length === 0) {
      setNoSkills(true);
      setLoadingMatches(false);
      return;
    }

    const myStrengthIds = mySkills.filter((s) => s.is_strength).map((s) => s.skill_id);
    const myWeaknessIds = mySkills.filter((s) => !s.is_strength).map((s) => s.skill_id);
    const myStrengthNames = new Map(
      mySkills.filter((s) => s.is_strength).map((s) => [s.skill_id, (s.skills as any)?.name || ""])
    );
    const myWeaknessNames = new Map(
      mySkills.filter((s) => !s.is_strength).map((s) => [s.skill_id, (s.skills as any)?.name || ""])
    );

    // 2. Get all other users' skills
    const { data: otherSkills } = await supabase
      .from("user_skills")
      .select("user_id, skill_id, is_strength, skills(name)")
      .neq("user_id", user.id);

    if (!otherSkills || otherSkills.length === 0) {
      setLoadingMatches(false);
      return;
    }

    // 3. Group by user
    const userMap = new Map<string, { strengths: { id: string; name: string }[]; weaknesses: { id: string; name: string }[] }>();
    for (const sk of otherSkills) {
      if (!userMap.has(sk.user_id)) {
        userMap.set(sk.user_id, { strengths: [], weaknesses: [] });
      }
      const entry = userMap.get(sk.user_id)!;
      const skillName = (sk.skills as any)?.name || "";
      if (sk.is_strength) {
        entry.strengths.push({ id: sk.skill_id, name: skillName });
      } else {
        entry.weaknesses.push({ id: sk.skill_id, name: skillName });
      }
    }

    // 4. Compute match scores
    const scored: { userId: string; score: number; theyCanTeach: string[]; iCanTeach: string[] }[] = [];
    for (const [userId, data] of userMap) {
      // Their strengths ∩ My weaknesses = they can teach me
      const theyCanTeach = data.strengths
        .filter((s) => myWeaknessIds.includes(s.id))
        .map((s) => s.name);

      // My strengths ∩ Their weaknesses = I can teach them
      const iCanTeach = data.weaknesses
        .filter((s) => myStrengthIds.includes(s.id))
        .map((s) => myStrengthNames.get(s.id) || s.name);

      // Score: weighted sum (bidirectional matches are best)
      const teachScore = theyCanTeach.length * 30;
      const learnScore = iCanTeach.length * 20;
      const bidirectionalBonus = Math.min(theyCanTeach.length, iCanTeach.length) * 15;
      const score = teachScore + learnScore + bidirectionalBonus;

      if (score > 0) {
        scored.push({ userId, score, theyCanTeach, iCanTeach });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const topUsers = scored.slice(0, 20);

    if (topUsers.length === 0) {
      setLoadingMatches(false);
      return;
    }

    // 5. Fetch profiles
    const userIds = topUsers.map((u) => u.userId);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, bio, major, year")
      .in("id", userIds);

    // 6. Check existing matches
    const { data: existingMatches } = await supabase
      .from("matches")
      .select("id, user1_id, user2_id, status")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    const matchMap = new Map<string, { id: string; status: string }>();
    for (const m of existingMatches || []) {
      const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
      matchMap.set(otherId, { id: m.id, status: m.status });
    }

    // 7. Build results
    const results: MatchedUser[] = topUsers.map((tu) => {
      const prof = profiles?.find((p) => p.id === tu.userId);
      const existing = matchMap.get(tu.userId);
      return {
        id: tu.userId,
        full_name: prof?.full_name || "Unknown User",
        bio: prof?.bio || null,
        major: prof?.major || null,
        year: prof?.year || null,
        matchScore: Math.min(Math.round((tu.score / (Math.max(myWeaknessIds.length, myStrengthIds.length) * 45)) * 100), 99),
        theyCanTeach: tu.theyCanTeach,
        iCanTeach: tu.iCanTeach,
        matchId: existing?.id,
        matchStatus: existing?.status,
      };
    });

    setMatches(results);
    setLoadingMatches(false);
  }

  async function sendMatchRequest(otherUserId: string) {
    if (!user) return;
    setSending(otherUserId);

    const match = matches.find((m) => m.id === otherUserId);
    const allSkills = [...(match?.theyCanTeach || []), ...(match?.iCanTeach || [])];

    const { data, error } = await supabase
      .from("matches")
      .insert({
        user1_id: user.id,
        user2_id: otherUserId,
        match_score: match?.matchScore || 0,
        matched_skills: allSkills,
        status: "pending",
      })
      .select("id")
      .single();

    if (!error && data) {
      setMatches((prev) =>
        prev.map((m) =>
          m.id === otherUserId ? { ...m, matchId: data.id, matchStatus: "pending" } : m
        )
      );
    }
    setSending(null);
  }

  async function acceptMatch(matchId: string, otherUserId: string) {
    setSending(otherUserId);
    await supabase.from("matches").update({ status: "accepted" }).eq("id", matchId);
    setMatches((prev) =>
      prev.map((m) => (m.id === otherUserId ? { ...m, matchStatus: "accepted" } : m))
    );
    setSending(null);
  }

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

  return (
    <div style={{ minHeight: "100vh", padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div className="fade-in" style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, marginBottom: "0.25rem" }}>
            AI <span className="gradient-text">Matching</span> 🤝
          </h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            We analyze your skills to find the best study partners.
          </p>
        </div>

        {/* How it works */}
        <div className="fade-in fade-in-delay-1 card" style={{ cursor: "default", marginBottom: "2rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            🧠 How AI Matching Works
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            {[
              { step: "1", title: "Set Your Skills", desc: "Mark your strengths & weaknesses" },
              { step: "2", title: "Algorithm Analyzes", desc: "Cross-references all student profiles" },
              { step: "3", title: "Best Matches", desc: "Ranked by complementary skills" },
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

        {/* Content */}
        {loadingMatches ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 140, borderRadius: "var(--radius-lg)" }} />
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
        ) : matches.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", cursor: "default" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
            <h3 style={{ marginBottom: "0.5rem" }}>No Matches Found Yet</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
              As more students join, we&apos;ll find complementary study partners for you.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {matches.map((match, i) => (
              <div
                key={match.id}
                className={`fade-in fade-in-delay-${Math.min(i + 2, 5)} card card-glow`}
                style={{
                  cursor: "default",
                  borderLeft: `4px solid ${
                    match.matchScore >= 70
                      ? "#16a34a"
                      : match.matchScore >= 40
                      ? "var(--gsu-blue)"
                      : "var(--border-color)"
                  }`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                  {/* User Info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                      <div className="avatar" style={{
                        width: 44, height: 44,
                        background: "linear-gradient(135deg, var(--gsu-blue), var(--gsu-red))",
                        color: "white", fontWeight: 700,
                      }}>
                        {match.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{match.full_name}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          {[match.major, match.year].filter(Boolean).join(" • ") || "Student"}
                        </div>
                      </div>
                    </div>

                    {/* Skills */}
                    {match.theyCanTeach.length > 0 && (
                      <div style={{ marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--gsu-blue)", fontWeight: 600 }}>
                          Can teach you:
                        </span>
                        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                          {match.theyCanTeach.map((s) => (
                            <span key={s} className="badge badge-blue">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {match.iCanTeach.length > 0 && (
                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--gsu-red)", fontWeight: 600 }}>
                          You can teach:
                        </span>
                        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                          {match.iCanTeach.map((s) => (
                            <span key={s} className="badge badge-red">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Score + Actions */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: "50%",
                      border: `3px solid ${
                        match.matchScore >= 70 ? "#16a34a" : match.matchScore >= 40 ? "var(--gsu-blue)" : "var(--border-color)"
                      }`,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontSize: "1.25rem", fontWeight: 800, lineHeight: 1 }}>
                        {match.matchScore}
                      </span>
                      <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>score</span>
                    </div>

                    {match.matchStatus === "accepted" ? (
                      <Link href={`/sessions?partner=${match.id}`} className="btn btn-primary btn-sm">
                        Book Session
                      </Link>
                    ) : match.matchStatus === "pending" ? (
                      <button className="btn btn-secondary btn-sm" disabled>
                        Pending...
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => sendMatchRequest(match.id)}
                        disabled={sending === match.id}
                      >
                        {sending === match.id ? "..." : "Connect"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
