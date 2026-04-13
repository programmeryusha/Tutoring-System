import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { BADGES, type UserStats } from "@/lib/badges";

/* ─── GET /api/badges?user_id=xxx ───
   Returns badges for a given user. If the viewing user is the owner,
   also runs the check-and-award logic first.
   Query params:
     user_id  (required) — whose badges to fetch
     check    (optional) — "true" to run award logic (only for own profile)
*/
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    if (!userId) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 });
    }

    const shouldCheck = searchParams.get("check") === "true";

    if (shouldCheck) {
      await checkAndAward(userId);
    }

    // Fetch earned badges
    const { data: earned, error } = await supabase
      .from("user_badges")
      .select("badge_id, earned_at")
      .eq("user_id", userId)
      .order("earned_at", { ascending: true });

    if (error) throw error;

    // Merge with definitions
    const badges = BADGES.map((def) => {
      const match = (earned || []).find((e: any) => e.badge_id === def.id);
      return {
        id: def.id,
        name: def.name,
        icon: def.icon,
        description: def.description,
        category: def.category,
        earned: !!match,
        earned_at: match ? match.earned_at : null,
      };
    });

    return NextResponse.json({ badges });
  } catch (e: any) {
    console.error("Badges GET error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/* ─── Check and award new badges ─── */
async function checkAndAward(userId: string) {
  const stats = await gatherStats(userId);

  // Get already earned badge IDs
  const { data: existing } = await supabase
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId);

  const earnedSet = new Set((existing || []).map((e: any) => e.badge_id));

  // Check each badge
  const newBadges: string[] = [];
  for (const badge of BADGES) {
    if (earnedSet.has(badge.id)) continue;

    // Special handling for subject_expert
    if (badge.id === "subject_expert") {
      if (stats._maxSubjectSessions >= 15) {
        newBadges.push(badge.id);
      }
      continue;
    }

    if (badge.check(stats)) {
      newBadges.push(badge.id);
    }
  }

  // Insert new badges
  if (newBadges.length > 0) {
    await supabase.from("user_badges").insert(
      newBadges.map((badge_id) => ({
        user_id: userId,
        badge_id,
      }))
    );
  }
}

/* ─── Gather all stats for a user ─── */
async function gatherStats(
  userId: string
): Promise<UserStats & { _maxSubjectSessions: number }> {
  // Sessions as tutor (user1_id) and student (user2_id)
  const [
    { data: tutorSessions },
    { data: studentSessions },
    { data: reviews },
    { data: tutorReviews },
    { data: connections },
    { data: strengths },
  ] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, user2_id, skill_id, duration_minutes, scheduled_at")
      .eq("user1_id", userId)
      .eq("status", "completed"),
    supabase
      .from("sessions")
      .select("id, user1_id, skill_id, duration_minutes, scheduled_at")
      .eq("user2_id", userId)
      .eq("status", "completed"),
    supabase
      .from("reviews")
      .select("rating")
      .eq("reviewee_id", userId),
    supabase
      .from("reviews")
      .select("rating")
      .eq("reviewee_id", userId)
      .eq("reviewee_role", "tutor"),
    supabase
      .from("matches")
      .select("id")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq("status", "accepted"),
    supabase
      .from("user_skills")
      .select("skill_id")
      .eq("user_id", userId)
      .in("level", ["mastered", "proficient"]),
  ]);

  const ts = tutorSessions || [];
  const ss = studentSessions || [];
  const allSessions = [...ts, ...ss];

  // Total hours
  const totalMinutes = allSessions.reduce(
    (sum, s: any) => sum + (s.duration_minutes || 60),
    0
  );

  // Reviews
  const allReviews = reviews || [];
  const avgRating =
    allReviews.length > 0
      ? allReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / allReviews.length
      : null;

  const tReviews = tutorReviews || [];
  const tutorAvgRating =
    tReviews.length > 0
      ? tReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / tReviews.length
      : null;

  // Unique students tutored
  const uniqueStudents = new Set(ts.map((s: any) => s.user2_id)).size;
  const uniqueTutors = new Set(ss.map((s: any) => s.user1_id)).size;

  // Unique subjects
  const subjectCounts = new Map<number, number>();
  for (const s of allSessions) {
    const sid = (s as any).skill_id;
    if (sid) subjectCounts.set(sid, (subjectCounts.get(sid) || 0) + 1);
  }
  const maxSubjectSessions = Math.max(0, ...subjectCounts.values());

  // Streak calculation (consecutive weeks with at least 1 session)
  const weeks = new Set<string>();
  for (const s of allSessions) {
    const d = new Date((s as any).scheduled_at);
    // Get ISO week start (Monday)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff));
    weeks.add(weekStart.toISOString().slice(0, 10));
  }
  const sortedWeeks = Array.from(weeks).sort();
  let streak = 0;
  let currentStreak = 0;
  for (let i = 0; i < sortedWeeks.length; i++) {
    if (i === 0) {
      currentStreak = 1;
    } else {
      const prev = new Date(sortedWeeks[i - 1]);
      const curr = new Date(sortedWeeks[i]);
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 7) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
    }
    streak = Math.max(streak, currentStreak);
  }

  return {
    totalSessions: allSessions.length,
    tutorSessions: ts.length,
    studentSessions: ss.length,
    totalHours: totalMinutes / 60,
    avgRating,
    reviewCount: allReviews.length,
    tutorAvgRating,
    tutorReviewCount: tReviews.length,
    uniqueStudents,
    uniqueTutors,
    uniqueSubjects: subjectCounts.size,
    connectionCount: (connections || []).length,
    streakWeeks: streak,
    strengthCount: (strengths || []).length,
    _maxSubjectSessions: maxSubjectSessions,
  };
}
