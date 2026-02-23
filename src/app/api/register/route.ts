import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "../../../lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
    const { username, email, password } = await req.json();
    if (!username || !email || !password) {
        return NextResponse.json(
            { error: "Username, email and password are required" },
            { status: 400 }
        );
    }

    // check if user already exists in database 
    const userRes = await pool.query(
        'select user_id from users where email = $1', [email]
    );
    const user = userRes.rows[0];

    if (user) {
        return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    // hash password. 
    const passwordHash = await bcrypt.hash(password, 10);

    // insert user into database 

    try {
    const result = await pool.query(
        'insert into users (username, email, password_hash) values ($1, $2, $3) returning user_id', [username, email, passwordHash]
    );

    return NextResponse.json({ user: result.rows[0]});
} catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
}
}
