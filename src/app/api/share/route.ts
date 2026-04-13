import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/* ─── GET /api/share?user_id=xxx ───
   Returns aggregated profile + stats + badges for the share card.
*/
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    if (!userId) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 });
    }

    /* Profile */
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, major, year, role")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    /* Session stats */
    const { data: sessions } = await supabase
      .from("sessions")
      .select("user1_id, user2_id, duration_minutes, status")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq("status", "completed");

    const rows = sessions || [];
    const totalSessions = rows.length;
    const tutorSessions = rows.filter((s: any) => s.user1_id === userId).length;
    const studentSessions = rows.filter((s: any) => s.user2_id === userId).length;
    const totalHours = Math.round(
      rows.reduce((sum: number, s: any) => sum + (s.duration_minutes || 60), 0) / 60 * 10
    ) / 10;

    /* Ratings */
    const { data: reviews } = await supabase
      .from("reviews")
      .select("rating, reviewee_role")
      .eq("reviewee_id", userId);

    const revs = reviews || [];
    const reviewCount = revs.length;
    const avgRating =
      reviewCount > 0
        ? Math.round(
            (revs.reduce((s: number, r: any) => s + r.rating, 0) / reviewCount) * 10
          ) / 10
        : null;
    const tutorRevs = revs.filter((r: any) => r.reviewee_role === "tutor");
    const tutorAvgRating =
      tutorRevs.length > 0
        ? Math.round(
            (tutorRevs.reduce((s: number, r: any) => s + r.rating, 0) / tutorRevs.length) * 10
          ) / 10
        : null;

    /* Connections */
    const { count: connectionCount } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq("status", "accepted");

    /* Skills (strengths) */
    const { data: skillRows } = await supabase
      .from("user_skills")
      .select("skills(name), level")
      .eq("user_id", userId)
      .in("level", ["proficient", "mastered"]);

    const strengths = (skillRows || []).map((r: any) => r.skills?.name).filter(Boolean);

    /* Badges */
    const { data: badgeRows } = await supabase
      .from("user_badges")
      .select("badge_id")
      .eq("user_id", userId);

    const earnedBadgeIds = (badgeRows || []).map((b: any) => b.badge_id);

    return NextResponse.json({
      profile: {
        full_name: profile.full_name,
        major: profile.major,
        year: profile.year,
        role: profile.role,
      },
      stats: {
        totalSessions,
        tutorSessions,
        studentSessions,
        totalHours,
        avgRating,
        tutorAvgRating,
        reviewCount,
        connectionCount: connectionCount || 0,
      },
      strengths,
      earnedBadgeIds,
    });
  } catch (e: any) {
    console.error("Share GET error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
