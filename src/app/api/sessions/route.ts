import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
const { searchParams } = new URL(req.url);
// search params is the string url
const user_id = searchParams.get("user_id");
if (!user_id) {
    return NextResponse.json(
        { error: "Missing user_id" },
        { status: 400 }
    );
}

// show user a sehedule of their sessions by getting them from the database
const res = await pool.query(
    'select s.*, sk.skill_name from sessions s join skils sk on s.skill_id = sk.skill_id where s.user_id = $1 order by s.session_time desc', [user_id]
);
return NextResponse.json({ sessions: res.rows });
}
// booking a session and adding it to the database
export async function POST(req: Request) {
    const { student_id, tutor_id, skill_id, scheduled_at, duration_minutes } = await req.json();
    if (!student_id || !tutor_id || !skill_id || !scheduled_at || !duration_minutes) {
        return NextResponse.json(
            { error: "Missing required fields" },
            { status: 400 }
        );
    }
    
    try {
        const res = await pool.query(
            'insert into sessions (student_id, tutor_id, skill_id, session_time, duration_minutes) values ($1, $2, $3, $4, $5) returning session_id', [student_id, tutor_id, skill_id, scheduled_at, duration_minutes]
        );
        return NextResponse.json({ session_id: res.rows[0].session_id });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}