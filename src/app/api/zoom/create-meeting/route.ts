import { NextResponse } from "next/server";

export const runtime = "nodejs";

/* ── Get Zoom Server-to-Server OAuth Token ── */
async function getZoomAccessToken(): Promise<string> {
  const accountId = process.env.ZOOM_ACCOUNT_ID!;
  const clientId = process.env.ZOOM_CLIENT_ID!;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET!;

  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoom token error: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

/* ── POST /api/zoom/create-meeting ── */
export async function POST(req: Request) {
  try {
    const { topic, duration, startTime } = await req.json();

    // Validate env vars
    if (!process.env.ZOOM_ACCOUNT_ID || !process.env.ZOOM_CLIENT_ID || !process.env.ZOOM_CLIENT_SECRET) {
      return NextResponse.json(
        { error: "Zoom credentials not configured" },
        { status: 500 }
      );
    }

    const accessToken = await getZoomAccessToken();

    const meetingRes = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: topic || "PantherTutor Session",
        type: 2, // scheduled meeting
        start_time: startTime, // ISO 8601
        duration: duration || 60, // minutes
        timezone: "America/New_York",
        settings: {
          join_before_host: true,
          waiting_room: false,
          meeting_authentication: false,
          auto_recording: "none",
        },
      }),
    });

    if (!meetingRes.ok) {
      const text = await meetingRes.text();
      console.error("Zoom create meeting error:", text);
      return NextResponse.json(
        { error: "Failed to create Zoom meeting" },
        { status: 500 }
      );
    }

    const meeting = await meetingRes.json();

    return NextResponse.json({
      join_url: meeting.join_url,
      meeting_id: meeting.id,
      password: meeting.password,
    });
  } catch (e: any) {
    console.error("Zoom API error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
