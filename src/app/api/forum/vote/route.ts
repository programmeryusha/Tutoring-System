import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/* ─── POST /api/forum/vote ───
   Toggle upvote / downvote on a thread or reply.
   Body: { user_id, target_type: 'thread'|'reply', target_id, vote: 1|-1 }
   
   Logic:
   - If user has same vote → remove it (toggle off)
   - If user has opposite vote → switch it
   - If no existing vote → insert it
*/
export async function POST(req: Request) {
  try {
    const { user_id, target_type, target_id, vote } = await req.json();

    if (!user_id || !target_type || !target_id || ![1, -1].includes(vote)) {
      return NextResponse.json({ error: "Invalid vote payload" }, { status: 400 });
    }

    const table = target_type === "thread" ? "forum_threads" : "forum_replies";

    // Check existing vote
    const { data: existing } = await supabase
      .from("forum_votes")
      .select("id, vote")
      .eq("user_id", user_id)
      .eq("target_type", target_type)
      .eq("target_id", target_id)
      .maybeSingle();

    let deltaUp = 0;
    let deltaDown = 0;

    if (existing) {
      if (existing.vote === vote) {
        // Same vote → remove (toggle off)
        await supabase.from("forum_votes").delete().eq("id", existing.id);
        if (vote === 1) deltaUp = -1;
        else deltaDown = -1;
      } else {
        // Opposite vote → switch
        await supabase.from("forum_votes").update({ vote }).eq("id", existing.id);
        if (vote === 1) {
          deltaUp = 1;
          deltaDown = -1;
        } else {
          deltaUp = -1;
          deltaDown = 1;
        }
      }
    } else {
      // No existing → insert
      const { error } = await supabase.from("forum_votes").insert({
        user_id,
        target_type,
        target_id,
        vote,
      });
      if (error) throw error;
      if (vote === 1) deltaUp = 1;
      else deltaDown = 1;
    }

    // Update counts on the target
    const { data: current } = await supabase
      .from(table)
      .select("upvotes, downvotes")
      .eq("id", target_id)
      .single();

    if (current) {
      await supabase
        .from(table)
        .update({
          upvotes: Math.max(0, (current.upvotes || 0) + deltaUp),
          downvotes: Math.max(0, (current.downvotes || 0) + deltaDown),
        })
        .eq("id", target_id);
    }

    // Return new user vote state
    const newVote = existing && existing.vote === vote ? 0 : vote;
    return NextResponse.json({ userVote: newVote });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
