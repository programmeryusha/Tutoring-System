import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/rateLimit";
import { sanitizeText } from "@/lib/sanitize";

/* ─── GET /api/forum ───
   List threads, optionally filtered by skill_id and sorted.
   Query params:
     skill_id  — filter to one subject
     sort      — "new" (default) | "top" | "unresolved"
     search    — text search in title/body
     page      — pagination (1-based, 20 per page)
*/
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const skillId = searchParams.get("skill_id");
    const sort = searchParams.get("sort") || "new";
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const perPage = 20;

    let query = supabase
      .from("forum_threads")
      .select(
        "id, author_id, skill_id, title, body, tag, is_resolved, upvotes, downvotes, reply_count, created_at, profiles(full_name), skills(name)",
        { count: "exact" }
      );

    if (skillId) {
      query = query.eq("skill_id", parseInt(skillId));
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`);
    }

    if (sort === "top") {
      // Sort by net upvotes (upvotes - downvotes) descending
      query = query.order("upvotes", { ascending: false });
    } else if (sort === "unresolved") {
      query = query.eq("is_resolved", false).order("created_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    query = query.range((page - 1) * perPage, page * perPage - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const threads = (data || []).map((t: any) => ({
      id: t.id,
      author_id: t.author_id,
      author_name: t.profiles?.full_name || "Panther Student",
      skill_id: t.skill_id,
      skill_name: t.skills?.name || "General",
      title: t.title,
      body: t.body,
      tag: t.tag,
      is_resolved: t.is_resolved,
      upvotes: t.upvotes,
      downvotes: t.downvotes,
      reply_count: t.reply_count,
      created_at: t.created_at,
    }));

    return NextResponse.json({
      threads,
      total: count || 0,
      page,
      perPage,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/* ─── POST /api/forum ───
   Create a new thread.
   Body: { author_id, skill_id, title, body, tag? }
*/
export async function POST(req: Request) {
  try {
    // Rate limit: max 10 forum posts per minute per IP
    const rl = rateLimit(req, { limit: 10, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: rl.message }, { status: 429 });
    }

    const { author_id, skill_id, title, body, tag } = await req.json();

    if (!author_id || !skill_id || !title || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Sanitize inputs to prevent XSS
    const cleanTitle = sanitizeText(title);
    const cleanBody = sanitizeText(body);

    if (!cleanTitle || !cleanBody) {
      return NextResponse.json({ error: "Invalid input: HTML not allowed" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("forum_threads")
      .insert({
        author_id,
        skill_id,
        title: cleanTitle,
        body: cleanBody,
        tag: tag || "question",
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
