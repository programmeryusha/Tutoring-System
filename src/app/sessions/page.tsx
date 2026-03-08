"use client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";

interface SessionData {
  id: string;
  subject: string;
  scheduled_at: string;
  duration: number;
  status: string;
  notes: string | null;
  meeting_link: string | null;
  tutor_id: string;
  student_id: string;
  tutor_name?: string;
  student_name?: string;
}

interface AcceptedMatch {
  id: string;
  other_id: string;
  other_name: string;
  matched_skills: string[];
}

function SessionsContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const partnerId = searchParams.get("partner");

  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [acceptedMatches, setAcceptedMatches] = useState<AcceptedMatch[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "book">(partnerId ? "book" : "upcoming");

  // Booking state
  const [selectedMatch, setSelectedMatch] = useState(partnerId || "");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  async function fetchData() {
    if (!user) return;
    setLoadingData(true);

    // Fetch sessions
    const { data: sess } = await supabase
      .from("sessions")
      .select("id, subject, scheduled_at, duration, status, notes, meeting_link, tutor_id, student_id")
      .or(`tutor_id.eq.${user.id},student_id.eq.${user.id}`)
      .order("scheduled_at", { ascending: false });

    // Get unique user IDs to fetch names
    const userIds = new Set<string>();
    for (const s of sess || []) {
      userIds.add(s.tutor_id);
      userIds.add(s.student_id);
    }

    const profileMap = new Map<string, string>();
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(userIds));
      for (const p of profiles || []) {
        profileMap.set(p.id, p.full_name || "Unknown");
      }
    }

    const sessionsWithNames = (sess || []).map((s) => ({
      ...s,
      tutor_name: profileMap.get(s.tutor_id) || "Unknown",
      student_name: profileMap.get(s.student_id) || "Unknown",
    }));
    setSessions(sessionsWithNames);

    // Fetch accepted matches for booking
    const { data: matchRows } = await supabase
      .from("matches")
      .select("id, user1_id, user2_id, matched_skills, status")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .eq("status", "accepted");

    if (matchRows && matchRows.length > 0) {
      const otherIds = matchRows.map((m) => (m.user1_id === user.id ? m.user2_id : m.user1_id));
      const { data: matchProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", otherIds);

      const nameMap = new Map<string, string>();
      for (const p of matchProfiles || []) {
        nameMap.set(p.id, p.full_name || "Unknown");
      }

      setAcceptedMatches(
        matchRows.map((m) => {
          const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
          return {
            id: m.id,
            other_id: otherId,
            other_name: nameMap.get(otherId) || "Unknown",
            matched_skills: m.matched_skills || [],
          };
        })
      );
    }

    setLoadingData(false);
  }

  async function handleBookSession() {
    if (!user || !selectedMatch || !subject || !date || !time) return;
    setBooking(true);

    const scheduledAt = new Date(`${date}T${time}`).toISOString();

    const { error } = await supabase.from("sessions").insert({
      tutor_id: selectedMatch,
      student_id: user.id,
      subject,
      scheduled_at: scheduledAt,
      duration,
      notes: notes || null,
      status: "scheduled",
    });

    if (!error) {
      setBookingSuccess(true);
      setSubject("");
      setDate("");
      setTime("");
      setNotes("");
      setSelectedMatch("");
      await fetchData();
      setTimeout(() => {
        setBookingSuccess(false);
        setActiveTab("upcoming");
      }, 2000);
    }
    setBooking(false);
  }

  async function cancelSession(sessionId: string) {
    await supabase.from("sessions").update({ status: "cancelled" }).eq("id", sessionId);
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status: "cancelled" } : s))
    );
  }

  async function completeSession(sessionId: string) {
    await supabase.from("sessions").update({ status: "completed" }).eq("id", sessionId);
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status: "completed" } : s))
    );
  }

  if (loading || !user || loadingData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="animate-spin" style={{
          width: 40, height: 40,
          border: "3px solid var(--border-color)", borderTopColor: "var(--gsu-blue)", borderRadius: "50%",
        }} />
      </div>
    );
  }

  const now = new Date();
  const upcoming = sessions.filter((s) => s.status === "scheduled" && new Date(s.scheduled_at) >= now);
  const past = sessions.filter((s) => s.status !== "scheduled" || new Date(s.scheduled_at) < now);

  const statusColors: Record<string, string> = {
    scheduled: "var(--gsu-blue)",
    completed: "#16a34a",
    cancelled: "var(--text-muted)",
    "no-show": "var(--gsu-red)",
  };

  const tabs = [
    { id: "upcoming" as const, label: `Upcoming (${upcoming.length})`, icon: "📅" },
    { id: "past" as const, label: `History (${past.length})`, icon: "📋" },
    { id: "book" as const, label: "Book Session", icon: "➕" },
  ];

  return (
    <div style={{ minHeight: "100vh", padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div className="fade-in" style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, marginBottom: "0.25rem" }}>
            <span className="gradient-text">Sessions</span> 📅
          </h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            Schedule and manage your tutoring sessions.
          </p>
        </div>

        {/* Tabs */}
        <div
          className="fade-in fade-in-delay-1"
          style={{
            display: "flex", gap: "0.5rem",
            marginBottom: "1.5rem", borderBottom: "1px solid var(--border-color)",
            overflowX: "auto",
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "0.75rem 1.25rem", border: "none", background: "none",
                cursor: "pointer", fontWeight: 600, fontSize: "0.95rem",
                color: activeTab === tab.id ? "var(--gsu-blue)" : "var(--text-muted)",
                borderBottom: activeTab === tab.id ? "3px solid var(--gsu-blue)" : "3px solid transparent",
                transition: "all 0.2s ease", whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: "0.5rem",
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="fade-in fade-in-delay-2">
          {/* Upcoming Sessions */}
          {activeTab === "upcoming" && (
            <div>
              {upcoming.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", cursor: "default" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📅</div>
                  <h3 style={{ marginBottom: "0.5rem" }}>No Upcoming Sessions</h3>
                  <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                    Book a session with one of your matches to get started.
                  </p>
                  <button className="btn btn-primary btn-sm" onClick={() => setActiveTab("book")}>
                    Book a Session
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {upcoming.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      userId={user.id}
                      statusColors={statusColors}
                      onCancel={cancelSession}
                      onComplete={completeSession}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Past Sessions */}
          {activeTab === "past" && (
            <div>
              {past.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", cursor: "default" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📋</div>
                  <h3>No Session History</h3>
                  <p style={{ color: "var(--text-muted)" }}>
                    Your completed and past sessions will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {past.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      userId={user.id}
                      statusColors={statusColors}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Book Session */}
          {activeTab === "book" && (
            <div className="card" style={{ cursor: "default" }}>
              {bookingSuccess ? (
                <div style={{ textAlign: "center", padding: "2rem 0" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
                  <h3 style={{ color: "#16a34a" }}>Session Booked!</h3>
                  <p style={{ color: "var(--text-muted)" }}>Redirecting to upcoming sessions...</p>
                </div>
              ) : acceptedMatches.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem 0" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🤝</div>
                  <h3 style={{ marginBottom: "0.5rem" }}>No Accepted Matches</h3>
                  <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                    You need at least one accepted match to book a session.
                  </p>
                  <a href="/matches" className="btn btn-primary btn-sm">Find Matches</a>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Book a Tutoring Session</h3>

                  <div className="input-group">
                    <label className="label">Study Partner</label>
                    <select
                      className="input"
                      value={selectedMatch}
                      onChange={(e) => {
                        setSelectedMatch(e.target.value);
                        const match = acceptedMatches.find((m) => m.other_id === e.target.value);
                        if (match && match.matched_skills.length > 0 && !subject) {
                          setSubject(match.matched_skills[0]);
                        }
                      }}
                    >
                      <option value="">Select a partner...</option>
                      {acceptedMatches.map((m) => (
                        <option key={m.other_id} value={m.other_id}>
                          {m.other_name} — {m.matched_skills.join(", ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label className="label">Subject</label>
                    <input
                      className="input"
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Calculus I, Data Structures"
                    />
                    {selectedMatch && acceptedMatches.find((m) => m.other_id === selectedMatch)?.matched_skills?.length ? (
                      <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                        {acceptedMatches
                          .find((m) => m.other_id === selectedMatch)
                          ?.matched_skills.map((s) => (
                            <button
                              key={s}
                              onClick={() => setSubject(s)}
                              className="badge badge-blue"
                              style={{
                                cursor: "pointer",
                                border: subject === s ? "2px solid var(--gsu-blue)" : "none",
                              }}
                            >
                              {s}
                            </button>
                          ))}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div className="input-group">
                      <label className="label">Date</label>
                      <input
                        className="input"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                      />
                    </div>
                    <div className="input-group">
                      <label className="label">Time</label>
                      <input
                        className="input"
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="label">Duration</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {[30, 60, 90, 120].map((d) => (
                        <button
                          key={d}
                          onClick={() => setDuration(d)}
                          style={{
                            padding: "0.5rem 1rem",
                            borderRadius: "var(--radius-full)",
                            border: duration === d ? "2px solid var(--gsu-blue)" : "1px solid var(--border-color)",
                            background: duration === d ? "rgba(0,57,166,0.1)" : "var(--bg-secondary)",
                            color: duration === d ? "var(--gsu-blue)" : "var(--text-secondary)",
                            cursor: "pointer", fontWeight: duration === d ? 600 : 400,
                            transition: "all 0.2s ease", fontSize: "0.9rem",
                          }}
                        >
                          {d} min
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="label">Notes (optional)</label>
                    <textarea
                      className="input"
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Topics to cover, questions to ask..."
                      style={{ resize: "vertical" }}
                    />
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={handleBookSession}
                    disabled={booking || !selectedMatch || !subject || !date || !time}
                  >
                    {booking ? "Booking..." : "📅 Book Session"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionCard({
  session,
  userId,
  statusColors,
  onCancel,
  onComplete,
}: {
  session: SessionData;
  userId: string;
  statusColors: Record<string, string>;
  onCancel?: (id: string) => void;
  onComplete?: (id: string) => void;
}) {
  const isUpcoming = session.status === "scheduled" && new Date(session.scheduled_at) >= new Date();
  const otherName = session.tutor_id === userId ? session.student_name : session.tutor_name;
  const role = session.tutor_id === userId ? "Tutoring" : "Learning from";

  return (
    <div
      className="card"
      style={{
        cursor: "default",
        borderLeft: `4px solid ${statusColors[session.status] || "var(--border-color)"}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{session.subject}</div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
            {role} <strong>{otherName}</strong>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            📅 {new Date(session.scheduled_at).toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric",
            })} at {new Date(session.scheduled_at).toLocaleTimeString("en-US", {
              hour: "numeric", minute: "2-digit",
            })} · {session.duration} min
          </div>
          {session.notes && (
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem", fontStyle: "italic" }}>
              &quot;{session.notes}&quot;
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
          <span
            className="badge"
            style={{
              background: statusColors[session.status] + "18",
              color: statusColors[session.status],
              border: `1px solid ${statusColors[session.status]}30`,
            }}
          >
            {session.status}
          </span>
          {isUpcoming && onCancel && onComplete && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn-sm" style={{
                background: "#16a34a15", color: "#16a34a", border: "1px solid #16a34a30",
                padding: "0.25rem 0.75rem", fontSize: "0.8rem", borderRadius: "var(--radius-md)",
                cursor: "pointer",
              }} onClick={() => onComplete(session.id)}>
                ✓ Complete
              </button>
              <button className="btn btn-sm" style={{
                background: "rgba(204,0,0,0.06)", color: "var(--gsu-red)", border: "1px solid rgba(204,0,0,0.2)",
                padding: "0.25rem 0.75rem", fontSize: "0.8rem", borderRadius: "var(--radius-md)",
                cursor: "pointer",
              }} onClick={() => onCancel(session.id)}>
                ✕ Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SessionsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="animate-spin" style={{
          width: 40, height: 40,
          border: "3px solid var(--border-color)", borderTopColor: "var(--gsu-blue)", borderRadius: "50%",
        }} />
      </div>
    }>
      <SessionsContent />
    </Suspense>
  );
}
