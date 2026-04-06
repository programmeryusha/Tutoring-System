"use client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface ProfileData {
  full_name: string;
  bio: string;
  major: string;
  year: string;
  vacation_mode: boolean;
}

interface SkillInfo {
  id: number;
  name: string;
}

interface ReviewDisplay {
  id: string;
  rating: number;
  review_text: string;
  created_at: string;
  reviewer_name: string;
  session_subject: string | null;
  reviewee_role: "tutor" | "student";
}

export default function MePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [strengths, setStrengths] = useState<SkillInfo[]>([]);
  const [weaknesses, setWeaknesses] = useState<SkillInfo[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [vacationToggling, setVacationToggling] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [reviews, setReviews] = useState<ReviewDisplay[]>([]);
  const [avgRatingTutor, setAvgRatingTutor] = useState<number | null>(null);
  const [avgRatingStudent, setAvgRatingStudent] = useState<number | null>(null);
  const [reviewCountTutor, setReviewCountTutor] = useState(0);
  const [reviewCountStudent, setReviewCountStudent] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoadingData(true);

      // Load profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, bio, major, year, vacation_mode")
        .eq("id", user!.id)
        .single();

      if (prof) {
        setProfile({
          full_name: prof.full_name || user!.user_metadata?.full_name || "",
          bio: prof.bio || "",
          major: prof.major || "",
          year: prof.year || "",
          vacation_mode: prof.vacation_mode || false,
        });
      } else {
        setProfile({
          full_name: user!.user_metadata?.full_name || "",
          bio: "",
          major: "",
          year: "",
          vacation_mode: false,
        });
      }

      // Load user skills with skill names
      const { data: us } = await supabase
        .from("user_skills")
        .select("skill_id, level, skills(id, name)")
        .eq("user_id", user!.id);

      const s: SkillInfo[] = [];
      const w: SkillInfo[] = [];
      for (const row of us || []) {
        const skill = row.skills as any;
        if (!skill) continue;
        if (row.level === "mastered" || row.level === "proficient") {
          s.push({ id: skill.id, name: skill.name });
        } else {
          w.push({ id: skill.id, name: skill.name });
        }
      }
      setStrengths(s);
      setWeaknesses(w);

      // Load reviews about me
      const { data: revs } = await supabase
        .from("reviews")
        .select("id, rating, review_text, created_at, reviewer_id, session_id, reviewee_role")
        .eq("reviewee_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (revs && revs.length > 0) {
        // Split ratings by role
        const tutorRevs = revs.filter((r: any) => r.reviewee_role === "tutor");
        const studentRevs = revs.filter((r: any) => r.reviewee_role === "student");

        if (tutorRevs.length > 0) {
          const total = tutorRevs.reduce((sum: number, r: any) => sum + r.rating, 0);
          setAvgRatingTutor(total / tutorRevs.length);
          setReviewCountTutor(tutorRevs.length);
        } else {
          setAvgRatingTutor(null);
          setReviewCountTutor(0);
        }

        if (studentRevs.length > 0) {
          const total = studentRevs.reduce((sum: number, r: any) => sum + r.rating, 0);
          setAvgRatingStudent(total / studentRevs.length);
          setReviewCountStudent(studentRevs.length);
        } else {
          setAvgRatingStudent(null);
          setReviewCountStudent(0);
        }

        // Get reviewer names
        const reviewerIds = [...new Set(revs.map((r: any) => r.reviewer_id))];
        const { data: reviewerProfs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", reviewerIds);
        const nameMap = new Map((reviewerProfs || []).map((p: any) => [p.id, p.full_name || "Panther Student"]));

        // Get session subjects
        const sessionIds = [...new Set(revs.map((r: any) => r.session_id))];
        const { data: sessList } = await supabase
          .from("sessions")
          .select("id, subject")
          .in("id", sessionIds);
        const subjMap = new Map((sessList || []).map((s: any) => [String(s.id), s.subject]));

        setReviews(revs.map((r: any) => ({
          id: String(r.id),
          rating: r.rating,
          review_text: r.review_text,
          created_at: r.created_at,
          reviewer_name: nameMap.get(r.reviewer_id) || "Panther Student",
          session_subject: subjMap.get(String(r.session_id)) || null,
          reviewee_role: r.reviewee_role || "tutor",
        })));
      } else {
        setAvgRatingTutor(null);
        setAvgRatingStudent(null);
        setReviewCountTutor(0);
        setReviewCountStudent(0);
        setReviews([]);
      }

      setLoadingData(false);
    }
    load();
  }, [user]);

  const toggleVacation = async () => {
    if (!user || !profile) return;
    setVacationToggling(true);
    const newVal = !profile.vacation_mode;
    await supabase
      .from("profiles")
      .update({ vacation_mode: newVal, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    setProfile((p) => p ? { ...p, vacation_mode: newVal } : p);
    setVacationToggling(false);
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (!error) {
      setResetSent(true);
      setTimeout(() => setResetSent(false), 5000);
    }
    setResetLoading(false);
  };

  if (loading || !user || loadingData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="animate-spin" style={{
          width: 40, height: 40,
          border: "3px solid var(--border-color)", borderTopColor: "var(--gsu-blue)", borderRadius: "50%",
        }} />
      </div>
    );
  }

  const initials = (profile?.full_name || user.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div style={{ minHeight: "100vh", padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        {/* Header Card */}
        <div className="fade-in card" style={{ cursor: "default", textAlign: "center", padding: "2rem" }}>
          {/* Avatar */}
          <div style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--gsu-blue), var(--gsu-blue-light))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1rem",
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "white",
            letterSpacing: "0.05em",
          }}>
            {initials}
          </div>

          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 0.25rem" }}>
            {profile?.full_name || "No name set"}
          </h1>
          <p style={{ color: "var(--text-muted)", margin: "0 0 0.5rem", fontSize: "0.9rem" }}>
            {user.email}
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {profile?.major && (
              <span className="badge badge-blue">{profile.major}</span>
            )}
            {profile?.year && (
              <span className="badge badge-blue">{profile.year}</span>
            )}
            {profile?.vacation_mode && (
              <span className="badge badge-red">🏖️ Vacation Mode</span>
            )}
          </div>

          {/* Rating display - split by role */}
          {(avgRatingTutor !== null || avgRatingStudent !== null) && (
            <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
              {avgRatingTutor !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", minWidth: "75px", textAlign: "right" }}>As Tutor</span>
                  <div style={{ display: "flex", gap: "0.15rem" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} style={{ color: star <= Math.round(avgRatingTutor) ? "#f59e0b" : "var(--border-color)", fontSize: "1.1rem" }}>★</span>
                    ))}
                  </div>
                  <span style={{ fontWeight: 700, color: "#f59e0b", fontSize: "0.9rem" }}>{avgRatingTutor.toFixed(1)}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>({reviewCountTutor})</span>
                </div>
              )}
              {avgRatingStudent !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", minWidth: "75px", textAlign: "right" }}>As Student</span>
                  <div style={{ display: "flex", gap: "0.15rem" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} style={{ color: star <= Math.round(avgRatingStudent) ? "#3b82f6" : "var(--border-color)", fontSize: "1.1rem" }}>★</span>
                    ))}
                  </div>
                  <span style={{ fontWeight: 700, color: "#3b82f6", fontSize: "0.9rem" }}>{avgRatingStudent.toFixed(1)}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>({reviewCountStudent})</span>
                </div>
              )}
            </div>
          )}

          {profile?.bio && (
            <p style={{ color: "var(--text-secondary)", margin: "1rem 0 0", fontSize: "0.95rem", lineHeight: 1.6 }}>
              {profile.bio}
            </p>
          )}

          <Link
            href="/profile"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              marginTop: "1.25rem",
              color: "var(--gsu-blue)",
              fontWeight: 600,
              fontSize: "0.9rem",
              textDecoration: "none",
            }}
          >
            ✏️ Edit Profile
          </Link>
        </div>

        {/* Skills Section */}
        <div className="fade-in fade-in-delay-1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1.25rem" }}>
          {/* Strengths */}
          <div className="card" style={{ cursor: "default" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              💪 <span style={{ color: "var(--gsu-blue)" }}>Strengths</span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 400 }}>({strengths.length})</span>
            </h3>
            {strengths.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {strengths.map((s) => (
                  <span key={s.id} className="badge badge-blue" style={{ fontSize: "0.8rem" }}>{s.name}</span>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: 0 }}>
                No strengths set yet.{" "}
                <Link href="/profile" style={{ color: "var(--gsu-blue)" }}>Add some</Link>
              </p>
            )}
          </div>

          {/* Weaknesses */}
          <div className="card" style={{ cursor: "default" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              📚 <span style={{ color: "var(--gsu-red)" }}>Need Help</span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 400 }}>({weaknesses.length})</span>
            </h3>
            {weaknesses.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {weaknesses.map((s) => (
                  <span key={s.id} className="badge badge-red" style={{ fontSize: "0.8rem" }}>{s.name}</span>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: 0 }}>
                No weaknesses set yet.{" "}
                <Link href="/profile" style={{ color: "var(--gsu-blue)" }}>Add some</Link>
              </p>
            )}
          </div>
        </div>

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <div className="fade-in fade-in-delay-2 card" style={{ cursor: "default", marginTop: "1.25rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              ⭐ <span>Reviews</span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 400 }}>({reviews.length})</span>
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {reviews.slice(0, 10).map((r) => (
                <div key={r.id} style={{
                  padding: "0.75rem 1rem",
                  background: "var(--bg-secondary)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{r.reviewer_name}</span>
                      <span style={{
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        padding: "0.1rem 0.4rem",
                        borderRadius: "6px",
                        background: r.reviewee_role === "tutor" ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.12)",
                        color: r.reviewee_role === "tutor" ? "#d97706" : "#3b82f6",
                        border: `1px solid ${r.reviewee_role === "tutor" ? "rgba(245,158,11,0.3)" : "rgba(59,130,246,0.3)"}`,
                      }}>
                        as {r.reviewee_role === "tutor" ? "Tutor" : "Student"}
                      </span>
                      <div style={{ display: "flex", gap: "0.1rem" }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} style={{ color: star <= r.rating ? "#f59e0b" : "var(--border-color)", fontSize: "0.85rem" }}>★</span>
                        ))}
                      </div>
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  {r.session_subject && (
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                      Session: {r.session_subject}
                    </div>
                  )}
                  <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    &quot;{r.review_text}&quot;
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Section */}
        <div className="fade-in fade-in-delay-2 card" style={{ cursor: "default", marginTop: "1.25rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "1rem" }}>⚙️ Settings</h3>

          {/* Vacation Mode Toggle */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem",
            borderRadius: "var(--radius-lg)",
            border: `1px solid ${profile?.vacation_mode ? "var(--gsu-red)" : "var(--border-color)"}`,
            background: profile?.vacation_mode ? "rgba(204,0,0,0.05)" : "var(--bg-secondary)",
            marginBottom: "1rem",
            transition: "all 0.2s ease",
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                🏖️ Vacation Mode
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>
                When on, your strengths are hidden from matching. You can still find tutors.
              </p>
            </div>
            <button
              onClick={toggleVacation}
              disabled={vacationToggling}
              style={{
                width: 52,
                height: 28,
                borderRadius: 14,
                border: "none",
                background: profile?.vacation_mode ? "var(--gsu-red)" : "var(--border-color)",
                cursor: vacationToggling ? "wait" : "pointer",
                position: "relative",
                transition: "background 0.2s ease",
                flexShrink: 0,
                opacity: vacationToggling ? 0.6 : 1,
              }}
              aria-label="Toggle vacation mode"
            >
              <span style={{
                position: "absolute",
                top: 3,
                left: profile?.vacation_mode ? 27 : 3,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "white",
                transition: "left 0.2s ease",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </button>
          </div>

          {/* Reset Password */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-color)",
            background: "var(--bg-secondary)",
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                🔒 Reset Password
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>
                A password reset link will be sent to your email.
              </p>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleResetPassword}
              disabled={resetLoading || resetSent}
              style={{
                flexShrink: 0,
                fontSize: "0.85rem",
                color: resetSent ? "#16a34a" : undefined,
              }}
            >
              {resetSent ? "✓ Email Sent" : resetLoading ? "Sending..." : "Send Link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
