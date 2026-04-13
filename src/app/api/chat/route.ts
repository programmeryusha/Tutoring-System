import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ─── Platform FAQ injected into system prompt ─── */
const PLATFORM_FAQ = `
PantherTutor Platform FAQ:
- To book a session: Go to Sessions → click "Book Session" → pick a connection, date/time, and notes.
- To find a tutor/study partner: Go to Matches → click "Find Matches" → review AI-suggested matches → send a request.
- Matching algorithm: AI scores users by complementary skills (your weakness = their strength), shared subjects, availability, and ratings.
- Sessions support Zoom (auto-created) or Jitsi (free, instant) video calls via the meeting type toggle.
- After a completed session, both the tutor and student can leave star ratings + written reviews.
- The Forum lets you post questions or discussions under any subject you're enrolled in. You can upvote/downvote and reply.
- Progress page shows analytics: sessions over time, hours, rating trends, subject distribution, streaks, and milestones.
- Badges are auto-awarded for achievements (e.g., First Session, Five Star, Subject Expert). Check your profile to see them.
- You can toggle Vacation Mode in your profile to pause incoming match requests.
- The Accessibility Panel (♿ button) offers font scaling, high contrast, dyslexia font, reduced motion, and more.
`;

/* ─── POST /api/chat ───
   Body: { user_id, messages: [{role, content}] }
   Returns: { reply: string }
*/
export async function POST(req: Request) {
  try {
    const { user_id, messages } = await req.json();

    if (!user_id || !messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Missing user_id or messages" }, { status: 400 });
    }

    // Gather user context from DB
    const [profileRes, skillsRes, sessionsRes, reviewsRes, badgesRes] = await Promise.all([
      supabase.from("profiles").select("full_name, major, year, bio").eq("id", user_id).single(),
      supabase
        .from("user_skills")
        .select("level, skills(name)")
        .eq("user_id", user_id),
      supabase
        .from("sessions")
        .select("subject, scheduled_at, status, duration_minutes")
        .or(`user1_id.eq.${user_id},user2_id.eq.${user_id}`)
        .order("scheduled_at", { ascending: false })
        .limit(10),
      supabase
        .from("reviews")
        .select("rating, reviewee_role")
        .eq("reviewee_id", user_id),
      supabase
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", user_id),
    ]);

    const profile = profileRes.data;
    const skills = skillsRes.data || [];
    const sessions = sessionsRes.data || [];
    const reviews = reviewsRes.data || [];
    const badges = badgesRes.data || [];

    // Build skill summary
    const strengths = skills
      .filter((s: any) => s.level === "mastered" || s.level === "proficient")
      .map((s: any) => s.skills?.name)
      .filter(Boolean);
    const weaknesses = skills
      .filter((s: any) => s.level === "needs_help")
      .map((s: any) => s.skills?.name)
      .filter(Boolean);

    // Session stats
    const upcoming = sessions.filter(
      (s: any) => s.status === "scheduled" && new Date(s.scheduled_at) > new Date()
    );
    const completed = sessions.filter((s: any) => s.status === "completed");
    const totalHours = completed.reduce(
      (sum: number, s: any) => sum + (s.duration_minutes || 60) / 60,
      0
    );

    // Rating summary
    const tutorReviews = reviews.filter((r: any) => r.reviewee_role === "tutor");
    const studentReviews = reviews.filter((r: any) => r.reviewee_role === "student");
    const avgTutor =
      tutorReviews.length > 0
        ? (tutorReviews.reduce((s: number, r: any) => s + r.rating, 0) / tutorReviews.length).toFixed(1)
        : "N/A";
    const avgStudent =
      studentReviews.length > 0
        ? (studentReviews.reduce((s: number, r: any) => s + r.rating, 0) / studentReviews.length).toFixed(1)
        : "N/A";

    const systemPrompt = `You are PantherBot 🐾, the friendly AI study assistant for PantherTutor — Georgia State University's peer-to-peer tutoring platform.

Your personality: Helpful, encouraging, knowledgeable, concise. Use emojis occasionally. Always be supportive and motivating.

You can help with:
1. ACADEMIC QUESTIONS — Explain concepts, solve problems, give examples for any subject the student is studying. You are an expert tutor.
2. PLATFORM HELP — Answer questions about how PantherTutor works (booking sessions, finding matches, using the forum, etc.).
3. STUDY TIPS — Provide study strategies, time management advice, and learning techniques.
4. PERSONAL STATS — Share the student's profile info, upcoming sessions, ratings, and progress when asked.

CURRENT USER CONTEXT:
- Name: ${profile?.full_name || "Student"}
- Major: ${profile?.major || "Undeclared"}
- Year: ${profile?.year || "N/A"}
- Strengths (can tutor): ${strengths.length > 0 ? strengths.join(", ") : "None set yet"}
- Weaknesses (needs help): ${weaknesses.length > 0 ? weaknesses.join(", ") : "None set yet"}
- Upcoming sessions: ${upcoming.length} scheduled
- Completed sessions: ${completed.length}
- Total tutoring hours: ${totalHours.toFixed(1)}
- Tutor rating: ${avgTutor}/5 (${tutorReviews.length} reviews)
- Student rating: ${avgStudent}/5 (${studentReviews.length} reviews)
- Badges earned: ${badges.length}
${upcoming.length > 0 ? `\nNext sessions:\n${upcoming.slice(0, 3).map((s: any) => `  - ${s.subject || "General"} on ${new Date(s.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`).join("\n")}` : ""}

${PLATFORM_FAQ}

RULES:
- Keep responses concise (2-4 paragraphs max unless the user asks for a detailed explanation).
- For academic questions, provide clear explanations with examples when helpful.
- If asked about a subject not in the user's skill list, still help — but mention they might want to add it to their profile.
- Never make up session or profile data. Only reference what's in the context above.
- If you don't know something about the platform, say so honestly.
- Format code with markdown code blocks when relevant.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-20), // Last 20 messages for context window
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const reply = response.choices[0]?.message?.content || "Sorry, I couldn't generate a response. Please try again! 🐾";

    return NextResponse.json({ reply });
  } catch (e: any) {
    console.error("Chat API error:", e);

    // Friendly fallback if API key is missing or invalid
    if (e.message?.includes("API key") || e.status === 401) {
      return NextResponse.json({
        reply: "🐾 PantherBot is being set up! The OpenAI API key hasn't been configured yet. Please add your `OPENAI_API_KEY` to `.env.local` and restart the server.",
      });
    }

    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
