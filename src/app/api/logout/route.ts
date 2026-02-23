import { NextResponse} from "next/server";
import { pool } from "../../../lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
    const { user_id } = await req.json();
    // if user id is missing, return error
    if (!user_id) {
        return NextResponse.json(
            { error: "Missing user_id" },
            { status: 400 }
        );
    }

    // delete session for user by getting rid of it from the database
    try {
        await pool.query(
            'update login_history set logout_time = now() where user_id = $1 and logout_time is null', [user_id]
        );
        return NextResponse.json({ message: "Logout successful" });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
