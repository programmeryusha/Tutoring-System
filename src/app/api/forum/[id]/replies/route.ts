import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/rateLimit";
import { sanitizeText } from "@/lib/sanitize";

/* ─── POST /api/forum/[id]/replies ───
   Add a reply to a thread.
   Body: { author_id, body, reply_to_id? }
*/
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const threadId = parseInt(id);
    const { author_id, body, reply_to_id } = await req.json();

    if (!author_id || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Rate limit: max 20 replies per minute per IP
    const rl = rateLimit(req, { limit: 20, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: rl.message }, { status: 429 });
    }

    // Sanitize to prevent XSS
    const cleanBody = sanitizeText(body);
    if (!cleanBody) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("forum_replies")
      .insert({
        thread_id: threadId,
        author_id,
        body: cleanBody,
        reply_to_id: reply_to_id || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    // Increment reply_count on the thread
    const { data: t } = await supabase
      .from("forum_threads")
      .select("reply_count")
      .eq("id", threadId)
      .single();

    if (t) {
      await supabase
        .from("forum_threads")
        .update({ reply_count: (t.reply_count || 0) + 1 })
        .eq("id", threadId);
    }

    return NextResponse.json({ id: data.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
