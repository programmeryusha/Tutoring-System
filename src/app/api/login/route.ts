import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "../../../lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const { emailorUsername, password } = await req.json();

        if (!emailorUsername || !password) {
            return NextResponse.json(
                { error: "Email/Username and password are required" },
                { status: 400 }
            );
        }

        // Find user
        const userRes = await pool.query(
            `select user_id, username, email, password_hash
             from users
             where email = $1 or username = $1
             limit 1`,
            [emailorUsername]
        );

        const user = userRes.rows[0];

        if (!user) {
            return NextResponse.json(
                { error: "Invalid email/username or password" },
                { status: 401 }
            );
        }

        // Compare password
        const ok = await bcrypt.compare(password, user.password_hash);

        if (!ok) {
            return NextResponse.json(
                { error: "Invalid email/username or password" },
                { status: 401 }
            );
        }

        // Record login event
        await pool.query(
            "insert into login_history (user_id) values ($1)",
            [user.user_id]
        );

        return NextResponse.json({
            user_id: user.user_id,
            username: user.username,
            email: user.email
        });

    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || "Login failed" },
            { status: 500 }
        );
    }
}
