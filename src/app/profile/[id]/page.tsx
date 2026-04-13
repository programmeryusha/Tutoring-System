"use client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

/* ─── Types ─── */
interface ProfileData {
  full_name: string;
  bio: string;
  major: string;
  year: string;
}

interface SkillItem {
  skill_id: number;
  name: string;
  level: string; // mastered | proficient | needs_help
}

interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  earned: boolean;
  earned_at: string | null;
}

interface ReviewItem {
  rating: number;
  review_text: string;
  reviewee_role: string;
  reviewer_name: string;
  created_at: string;
}

interface Stats {
  totalSessions: number;
  avgRating: number | null;
  reviewCount: number;
  connectionCount: number;
}

export default function PublicProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [strengths, setStrengths] = useState<SkillItem[]>([]);
  const [weaknesses, setWeaknesses] = useState<SkillItem[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalSessions: 0,
    avgRating: null,
    reviewCount: 0,
    connectionCount: 0,
  });
  const [loadingData, setLoadingData] = useState(true);
  const [isOwn, setIsOwn] = useState(false);
  const [relationship, setRelationship] = useState<"tutor" | "student" | "both" | "none">("none");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const loadProfile = useCallback(async () => {
    if (!user || !profileId) return;
    setLoadingData(true);

    const own = user.id === profileId;
    setIsOwn(own);

    // 1. Profile info
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, bio, major, year")
      .eq("id", profileId)
      .single();

    if (!prof) {
      setLoadingData(false);
      return;
    }
    setProfile({
      full_name: prof.full_name || "Panther Student",
      bio: prof.bio || "",
      major: prof.major || "",
      year: prof.year || "",
    });

    // 2. Skills (with skill names)
    const { data: userSkills } = await supabase
      .from("user_skills")
      .select("skill_id, level, skills(name)")
      .eq("user_id", profileId);

    const skillItems: SkillItem[] = (userSkills || []).map((s: any) => ({
      skill_id: s.skill_id,
      name: (s.skills as any)?.name || "Unknown",
      level: s.level,
    }));

    setStrengths(skillItems.filter((s) => s.level === "mastered" || s.level === "proficient"));
    setWeaknesses(skillItems.filter((s) => s.level === "needs_help"));

    // 3. Badges — trigger check if own profile
    const badgeRes = await fetch(
      `/api/badges?user_id=${profileId}${own ? "&check=true" : ""}`
    );
    const badgeData = await badgeRes.json();
    setBadges(badgeData.badges || []);

    // 4. Reviews (latest 6)
    const { data: reviewData } = await supabase
      .from("reviews")
      .select("rating, review_text, reviewee_role, reviewer_id, created_at")
      .eq("reviewee_id", profileId)
      .order("created_at", { ascending: false })
      .limit(6);

    if (reviewData && reviewData.length > 0) {
      const reviewerIds = reviewData.map((r: any) => r.reviewer_id);
      const { data: reviewerProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", reviewerIds);

      const nameMap = new Map(
        (reviewerProfiles || []).map((p: any) => [p.id, p.full_name || "Student"])
      );

      setReviews(
        reviewData.map((r: any) => ({
          rating: r.rating,
          review_text: r.review_text,
          reviewee_role: r.reviewee_role,
          reviewer_name: nameMap.get(r.reviewer_id) || "Student",
          created_at: r.created_at,
        }))
      );
    }

    // 5. Stats
    const [
      { data: sessions1 },
      { data: sessions2 },
      { data: allReviews },
      { data: conns },
    ] = await Promise.all([
      supabase
        .from("sessions")
        .select("id")
        .eq("user1_id", profileId)
        .eq("status", "completed"),
      supabase
        .from("sessions")
        .select("id")
        .eq("user2_id", profileId)
        .eq("status", "completed"),
      supabase.from("reviews").select("rating").eq("reviewee_id", profileId),
      supabase
        .from("matches")
        .select("id")
        .or(`user1_id.eq.${profileId},user2_id.eq.${profileId}`)
        .eq("status", "accepted"),
    ]);

    const totalSessions = (sessions1 || []).length + (sessions2 || []).length;
    const revs = allReviews || [];
    const avgRating =
      revs.length > 0
        ? revs.reduce((sum: number, r: any) => sum + r.rating, 0) / revs.length
        : null;

    setStats({
      totalSessions,
      avgRating,
      reviewCount: revs.length,
      connectionCount: (conns || []).length,
    });

    // 6. Determine relationship (are they my tutor or student?)
    if (!own) {
      const { data: matchData } = await supabase
        .from("matches")
        .select("user1_id, user2_id")
        .or(
          `and(user1_id.eq.${user.id},user2_id.eq.${profileId}),and(user1_id.eq.${profileId},user2_id.eq.${user.id})`
        )
        .eq("status", "accepted");

      if (matchData && matchData.length > 0) {
        const iAmTutor = matchData.some((m: any) => m.user1_id === user.id);
        const theyAreTutor = matchData.some((m: any) => m.user1_id === profileId);
        if (iAmTutor && theyAreTutor) setRelationship("both");
        else if (theyAreTutor) setRelationship("tutor");
        else if (iAmTutor) setRelationship("student");
      }
    }

    setLoadingData(false);
  }, [user, profileId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (authLoading || !user || loadingData) {
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

  if (!profile) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div style={{ fontSize: "3rem" }}>🔍</div>
        <h2>Profile Not Found</h2>
        <Link href="/matches" className="btn btn-primary">
          Back to Matches
        </Link>
      </div>
    );
  }

  const earnedBadges = badges.filter((b) => b.earned);
  const initials = profile.full_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Decide which skills to show based on relationship
  // "tutor shows strength only, student shows weakness only"
  // If they are my tutor → show their strengths (what they can teach me)
  // If they are my student → show their weaknesses (what they need help with)
  // If both or own or no relationship → show both
  const showStrengths =
    isOwn || relationship === "tutor" || relationship === "both" || relationship === "none";
  const showWeaknesses =
    isOwn || relationship === "student" || relationship === "both" || relationship === "none";

  return (
    <div style={{ minHeight: "100vh", padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Back link */}
        <Link
          href={isOwn ? "/profile" : "/matches"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            color: "var(--text-muted)",
            fontSize: "0.9rem",
            textDecoration: "none",
            marginBottom: "1.5rem",
            fontWeight: 500,
          }}
        >
          ← {isOwn ? "Edit Profile" : "Back to Matches"}
        </Link>

        {/* Profile Header */}
        <div
          className="fade-in card"
          style={{
            cursor: "default",
            display: "flex",
            alignItems: "center",
            gap: "1.5rem",
            flexWrap: "wrap",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--gsu-blue), var(--gsu-red))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "1.5rem",
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                margin: 0,
                marginBottom: "0.25rem",
              }}
            >
              {profile.full_name}
            </h1>
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                flexWrap: "wrap",
                color: "var(--text-muted)",
                fontSize: "0.9rem",
              }}
            >
              {profile.major && (
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  🎓 {profile.major}
                </span>
              )}
              {profile.year && (
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  📅 {profile.year}
                </span>
              )}
            </div>
            {profile.bio && (
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  marginTop: "0.5rem",
                  marginBottom: 0,
                  lineHeight: 1.5,
                }}
              >
                {profile.bio}
              </p>
            )}
            {relationship !== "none" && !isOwn && (
              <div
                style={{
                  marginTop: "0.5rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  padding: "0.2rem 0.7rem",
                  borderRadius: "var(--radius-full)",
                  background:
                    relationship === "tutor"
                      ? "rgba(0,57,166,0.1)"
                      : relationship === "student"
                      ? "rgba(204,0,0,0.08)"
                      : "rgba(147,51,234,0.08)",
                  color:
                    relationship === "tutor"
                      ? "var(--gsu-blue)"
                      : relationship === "student"
                      ? "var(--gsu-red)"
                      : "#9333ea",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                {relationship === "tutor"
                  ? "📘 Your Tutor"
                  : relationship === "student"
                  ? "📗 Your Student"
                  : "🔄 Tutor & Student"}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div
            style={{
              display: "flex",
              gap: "1rem",
              flexShrink: 0,
            }}
          >
            {[
              {
                value: stats.totalSessions,
                label: "Sessions",
                color: "var(--gsu-blue)",
              },
              {
                value: stats.avgRating ? stats.avgRating.toFixed(1) : "—",
                label: `Rating${stats.reviewCount > 0 ? ` (${stats.reviewCount})` : ""}`,
                color: "#f59e0b",
              },
              {
                value: earnedBadges.length,
                label: "Badges",
                color: "#9333ea",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  textAlign: "center",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--bg-secondary)",
                  minWidth: 65,
                }}
              >
                <div
                  style={{ fontSize: "1.25rem", fontWeight: 800, color: s.color }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-muted)",
                    fontWeight: 500,
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Badges Section */}
        {earnedBadges.length > 0 && (
          <div
            className="fade-in fade-in-delay-1 card"
            style={{ cursor: "default", marginTop: "1.25rem" }}
          >
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                marginBottom: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              🏅 Badges ({earnedBadges.length}/{badges.length})
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: "0.75rem",
              }}
            >
              {earnedBadges.map((badge) => (
                <div
                  key={badge.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "0.75rem 0.5rem",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    textAlign: "center",
                    transition: "all 0.2s ease",
                  }}
                  title={`${badge.description}\nEarned: ${
                    badge.earned_at
                      ? new Date(badge.earned_at).toLocaleDateString()
                      : ""
                  }`}
                >
                  <div style={{ fontSize: "1.75rem", marginBottom: "0.3rem" }}>
                    {badge.icon}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      lineHeight: 1.3,
                    }}
                  >
                    {badge.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--text-muted)",
                      marginTop: "0.2rem",
                    }}
                  >
                    {badge.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills Sections */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              showStrengths && showWeaknesses ? "1fr 1fr" : "1fr",
            gap: "1.25rem",
            marginTop: "1.25rem",
          }}
        >
          {/* Strengths (Can Teach) */}
          {showStrengths && strengths.length > 0 && (
            <div
              className="fade-in fade-in-delay-2 card"
              style={{ cursor: "default" }}
            >
              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  marginBottom: "0.75rem",
                  color: "var(--gsu-blue)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                💪 Can Teach
              </h3>
              <div
                style={{
                  display: "flex",
                  gap: "0.4rem",
                  flexWrap: "wrap",
                }}
              >
                {strengths.map((s) => (
                  <span
                    key={s.skill_id}
                    style={{
                      padding: "0.35rem 0.75rem",
                      borderRadius: "var(--radius-full)",
                      background: "rgba(0,57,166,0.1)",
                      color: "var(--gsu-blue)",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    {s.level === "mastered" ? "⭐" : "✓"} {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Weaknesses (Needs Help) */}
          {showWeaknesses && weaknesses.length > 0 && (
            <div
              className="fade-in fade-in-delay-2 card"
              style={{ cursor: "default" }}
            >
              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  marginBottom: "0.75rem",
                  color: "var(--gsu-red)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                📚 Needs Help With
              </h3>
              <div
                style={{
                  display: "flex",
                  gap: "0.4rem",
                  flexWrap: "wrap",
                }}
              >
                {weaknesses.map((s) => (
                  <span
                    key={s.skill_id}
                    style={{
                      padding: "0.35rem 0.75rem",
                      borderRadius: "var(--radius-full)",
                      background: "rgba(204,0,0,0.08)",
                      color: "var(--gsu-red)",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <div
            className="fade-in fade-in-delay-3 card"
            style={{ cursor: "default", marginTop: "1.25rem" }}
          >
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                marginBottom: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              💬 Recent Reviews
            </h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {reviews.map((r, i) => (
                <div
                  key={i}
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.3rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "0.9rem",
                        }}
                      >
                        {r.reviewer_name}
                      </span>
                      <span
                        style={{
                          padding: "0.15rem 0.5rem",
                          borderRadius: "var(--radius-full)",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          background:
                            r.reviewee_role === "tutor"
                              ? "rgba(0,57,166,0.08)"
                              : "rgba(204,0,0,0.08)",
                          color:
                            r.reviewee_role === "tutor"
                              ? "var(--gsu-blue)"
                              : "var(--gsu-red)",
                        }}
                      >
                        as {r.reviewee_role}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.2rem",
                        color: "#f59e0b",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                      }}
                    >
                      {"★".repeat(r.rating)}
                      {"☆".repeat(5 - r.rating)}
                    </div>
                  </div>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {r.review_text}
                  </p>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-muted)",
                      marginTop: "0.3rem",
                    }}
                  >
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Badges Grid (show locked ones too for own profile) */}
        {isOwn && (
          <div
            className="fade-in fade-in-delay-4 card"
            style={{ cursor: "default", marginTop: "1.25rem" }}
          >
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                marginBottom: "0.75rem",
              }}
            >
              🎯 All Badges ({earnedBadges.length}/{badges.length})
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: "0.75rem",
              }}
            >
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "0.75rem 0.5rem",
                    borderRadius: "var(--radius-lg)",
                    background: badge.earned
                      ? "var(--bg-secondary)"
                      : "var(--bg-primary)",
                    border: `1px solid ${
                      badge.earned ? "var(--gsu-blue)" : "var(--border-color)"
                    }`,
                    textAlign: "center",
                    opacity: badge.earned ? 1 : 0.4,
                    filter: badge.earned ? "none" : "grayscale(100%)",
                    transition: "all 0.2s ease",
                  }}
                  title={badge.description}
                >
                  <div style={{ fontSize: "1.75rem", marginBottom: "0.3rem" }}>
                    {badge.icon}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      lineHeight: 1.3,
                    }}
                  >
                    {badge.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--text-muted)",
                      marginTop: "0.2rem",
                    }}
                  >
                    {badge.earned
                      ? `Earned ${new Date(badge.earned_at!).toLocaleDateString()}`
                      : badge.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
