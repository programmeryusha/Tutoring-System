import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";

export const runtime = "nodejs";

// GET sessions
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const user_id = searchParams.get("user_id");

        if (!user_id) {
            return NextResponse.json(
                { error: "Missing user_id" },
                { status: 400 }
            );
        }

        const result = await pool.query(
            `
            select s.*, sk.skill_name
            from sessions s
            join skills sk on s.skill_id = sk.skill_id
            where s.student_id = $1
            order by s.scheduled_at
            `,
            [user_id]
        );

        return NextResponse.json({ sessions: result.rows });

    } catch (err: any) {
        return NextResponse.json(
            { error: err.message },
            { status: 500 }
        );
    }
}

// POST create session
export async function POST(req: Request) {
    try {
        const { student_id, skill_id, scheduled_at, duration_minutes } = await req.json();

        if (!student_id || !skill_id || !scheduled_at || !duration_minutes) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const res = await pool.query(
            `
            insert into sessions
            (student_id, skill_id, scheduled_at, duration_minutes)
            values ($1, $2, $3, $4)
            returning session_id
            `,
            [student_id, skill_id, scheduled_at, duration_minutes]
        );

        return NextResponse.json({ session_id: res.rows[0].session_id });

    } catch (e: any) {
        return NextResponse.json(
            { error: e.message },
            { status: 500 }
        );
    }
}