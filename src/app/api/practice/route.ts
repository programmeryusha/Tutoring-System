import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ─── POST /api/practice ───
   Body: { user_id, subject?: string, difficulty?: "easy"|"medium"|"hard", mode?: "daily"|"practice" }
   Returns: { question, options, hint, answer, explanation, subject, difficulty }
*/
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id, subject, difficulty = "medium", mode = "practice" } = body;

    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    /* ── Determine subject ── */
    let targetSubject = subject;

    if (!targetSubject) {
      // Pick from user's skills
      const { data: userSkills } = await supabase
        .from("user_skills")
        .select("skills(name)")
        .eq("user_id", user_id);

      const skillNames = (userSkills || [])
        .map((s: any) => s.skills?.name)
        .filter(Boolean);

      if (skillNames.length > 0) {
        if (mode === "daily") {
          // Use date-based seed for consistent daily challenge
          const dayOfYear = Math.floor(
            (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
          );
          targetSubject = skillNames[dayOfYear % skillNames.length];
        } else {
          targetSubject = skillNames[Math.floor(Math.random() * skillNames.length)];
        }
      } else {
        targetSubject = "General Computer Science";
      }
    }

    /* ── Build prompt ── */
    const dailySeed = mode === "daily"
      ? `\nToday's date seed: ${new Date().toISOString().slice(0, 10)}. Generate ONE specific problem for today — it should be the same problem if called multiple times today.`
      : "";

    const systemPrompt = `You are a practice problem generator for PantherTutor, a peer tutoring platform at Georgia State University.

Generate a ${difficulty}-level practice problem for the subject: "${targetSubject}".
${dailySeed}

RULES:
- The question should be educational, clear, and appropriate for a college student.
- For "easy": basic concept recall or simple application.
- For "medium": problem-solving requiring understanding of concepts.
- For "hard": complex multi-step problems or advanced analysis.
- Include 4 multiple-choice options labeled A, B, C, D.
- Only ONE option should be correct.
- Provide a helpful hint that nudges toward the answer without giving it away.
- Provide a clear explanation of why the correct answer is correct.

Respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{
  "question": "The question text here",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "hint": "A helpful hint here",
  "answer": "B",
  "explanation": "Detailed explanation of why B is correct..."
}`;

    /* ── If no API key, return a fallback problem ── */
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-PASTE_YOUR_KEY_HERE") {
      return NextResponse.json({
        question: `What is the primary purpose of version control systems like Git?`,
        options: [
          "A) To compile code faster",
          "B) To track changes and collaborate on code",
          "C) To deploy applications to servers",
          "D) To design user interfaces",
        ],
        hint: "Think about what happens when multiple developers work on the same project...",
        answer: "B",
        explanation:
          "Version control systems like Git are designed to track changes to code over time, allow multiple developers to collaborate, manage branches, and maintain a history of all modifications. While they complement deployment and other workflows, their primary purpose is change tracking and collaboration.",
        subject: targetSubject,
        difficulty,
      });
    }

    /* ── Call OpenAI ── */
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate a ${difficulty} practice problem for ${targetSubject}.` },
      ],
      temperature: mode === "daily" ? 0.3 : 0.9,
      max_tokens: 800,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";

    /* ── Parse JSON response ── */
    let parsed;
    try {
      // Strip potential code fences
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      parsed = JSON.parse(cleaned);
    } catch {
      // If parsing fails, return the raw text as a free-form question
      return NextResponse.json({
        question: raw,
        options: [],
        hint: "",
        answer: "",
        explanation: "",
        subject: targetSubject,
        difficulty,
      });
    }

    return NextResponse.json({
      question: parsed.question || "",
      options: parsed.options || [],
      hint: parsed.hint || "",
      answer: parsed.answer || "",
      explanation: parsed.explanation || "",
      subject: targetSubject,
      difficulty,
    });
  } catch (e: any) {
    console.error("Practice API error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
