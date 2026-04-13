import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/* ─── GET /api/forum/[id] ───
   Get a single thread with all its replies.
*/
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const threadId = parseInt(id);

    // Fetch thread
    const { data: thread, error: tErr } = await supabase
      .from("forum_threads")
      .select(
        "id, author_id, skill_id, title, body, tag, is_resolved, upvotes, downvotes, reply_count, created_at, profiles(full_name), skills(name)"
      )
      .eq("id", threadId)
      .single();

    if (tErr || !thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Fetch replies
    const { data: replies, error: rErr } = await supabase
      .from("forum_replies")
      .select("id, thread_id, author_id, reply_to_id, body, upvotes, downvotes, created_at, profiles(full_name)")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (rErr) throw rErr;

    // Build reply-to name map (for "↩ replying to X" display)
    const replyMap = new Map(
      (replies || []).map((r: any) => [r.id, r.profiles?.full_name || "Someone"])
    );

    const formattedReplies = (replies || []).map((r: any) => ({
      id: r.id,
      author_id: r.author_id,
      author_name: r.profiles?.full_name || "Panther Student",
      reply_to_id: r.reply_to_id,
      reply_to_name: r.reply_to_id ? replyMap.get(r.reply_to_id) || null : null,
      body: r.body,
      upvotes: r.upvotes,
      downvotes: r.downvotes,
      created_at: r.created_at,
    }));

    // Get current user's votes on this thread and its replies
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    let userVotes: Record<string, number> = {};

    if (userId) {
      const targetIds = [threadId, ...(replies || []).map((r: any) => r.id)];
      const { data: votes } = await supabase
        .from("forum_votes")
        .select("target_type, target_id, vote")
        .eq("user_id", userId)
        .in("target_id", targetIds);

      for (const v of votes || []) {
        userVotes[`${v.target_type}_${v.target_id}`] = v.vote;
      }
    }

    return NextResponse.json({
      thread: {
        id: thread.id,
        author_id: thread.author_id,
        author_name: (thread as any).profiles?.full_name || "Panther Student",
        skill_id: thread.skill_id,
        skill_name: (thread as any).skills?.name || "General",
        title: thread.title,
        body: thread.body,
        tag: thread.tag,
        is_resolved: thread.is_resolved,
        upvotes: thread.upvotes,
        downvotes: thread.downvotes,
        reply_count: thread.reply_count,
        created_at: thread.created_at,
      },
      replies: formattedReplies,
      userVotes,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/* ─── PATCH /api/forum/[id] ───
   Toggle is_resolved (only by thread author).
   Body: { author_id, is_resolved }
*/
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { author_id, is_resolved } = await req.json();

    const { error } = await supabase
      .from("forum_threads")
      .update({ is_resolved, updated_at: new Date().toISOString() })
      .eq("id", parseInt(id))
      .eq("author_id", author_id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
