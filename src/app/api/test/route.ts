import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await pool.query("select now()");
    return NextResponse.json({ time: result.rows[0].now });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}