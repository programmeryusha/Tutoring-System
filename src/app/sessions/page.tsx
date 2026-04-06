"use client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useMemo } from "react";
import { supabase } from "@/lib/supabase";

/* ── Types ── */
interface SessionData {
  id: string;
  subject: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  meeting_link: string | null;
  cancel_reason: string | null;
  user1_id: string;
  user2_id: string;
  user1_name?: string;
  user2_name?: string;
}

interface ReviewData {
  id: string;
  session_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  review_text: string;
  created_at: string;
}

interface AcceptedMatch {
  id: string;
  other_id: string;
  other_name: string;
  skill_id: number;
  skill_name: string;
}

interface BusySlot {
  start: Date;
  end: Date;
}

/* ── Helpers ── */
function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function generateTimeSlots(
  dateStr: string,
  durationMin: number,
  busySlots: BusySlot[]
): { time: string; label: string; available: boolean }[] {
  const slots: { time: string; label: string; available: boolean }[] = [];
  const now = new Date();
  const today = toLocalDateStr(now);

  for (let h = 8; h <= 21; h++) {
    for (const m of [0, 30]) {
      if (h === 21 && m === 30) continue;
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const timeStr = `${hh}:${mm}`;

      const slotStart = new Date(`${dateStr}T${timeStr}:00`);
      const slotEnd = new Date(slotStart.getTime() + durationMin * 60 * 1000);

      if (dateStr === today && slotStart <= now) continue;
      if (slotEnd.getHours() >= 22 && slotEnd.getMinutes() > 0) continue;

      const overlaps = busySlots.some(
        (b) => slotStart < b.end && slotEnd > b.start
      );

      const label = slotStart.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });

      slots.push({ time: timeStr, label, available: !overlaps });
    }
  }
  return slots;
}

/* ── Main Component ── */
function SessionsContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const partnerId = searchParams.get("partner");
  const skillParam = searchParams.get("skill");

  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [acceptedMatches, setAcceptedMatches] = useState<AcceptedMatch[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "book">(
    partnerId ? "book" : "upcoming"
  );
  const [errorMsg, setErrorMsg] = useState("");

  /* booking form */
  const [selectedMatch, setSelectedMatch] = useState(partnerId || "");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [meetingType, setMeetingType] = useState<"zoom" | "in-person">("zoom");
  const [location, setLocation] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [partnerBusy, setPartnerBusy] = useState<BusySlot[]>([]);
  const [myBusy, setMyBusy] = useState<BusySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  /* edit / cancel modals */
  const [editingSession, setEditingSession] = useState<SessionData | null>(null);
  const [cancellingSession, setCancellingSession] = useState<SessionData | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDuration, setEditDuration] = useState(60);
  const [editNotes, setEditNotes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editBusy, setEditBusy] = useState<BusySlot[]>([]);
  const [editMyBusy, setEditMyBusy] = useState<BusySlot[]>([]);
  const [loadingEditSlots, setLoadingEditSlots] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingCancel, setSavingCancel] = useState(false);

  /* review modal */
  const [reviewingSession, setReviewingSession] = useState<SessionData | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [myReviews, setMyReviews] = useState<Set<string>>(new Set()); // session IDs I already reviewed

  /* ── auth guard ── */
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ── load all data ── */
  async function fetchData() {
    if (!user) return;
    setLoadingData(true);

    const { data: sess, error: sessErr } = await supabase
      .from("sessions")
      .select("id, subject, scheduled_at, duration_minutes, status, notes, meeting_link, cancel_reason, user1_id, user2_id")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("scheduled_at", { ascending: false });

    if (sessErr) {
      console.error("Sessions fetch error:", sessErr);
    }

    const userIds = new Set<string>();
    for (const s of sess || []) {
      userIds.add(s.user1_id);
      if (s.user2_id) userIds.add(s.user2_id);
    }
    const profileMap = new Map<string, string>();
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(userIds));
      for (const p of profiles || []) profileMap.set(p.id, p.full_name || "Panther Student");
    }

    const sessionList = (sess || []).map((s: any) => ({
      id: s.id,
      subject: s.subject ?? null,
      scheduled_at: s.scheduled_at,
      duration_minutes: s.duration_minutes ?? 60,
      status: s.status,
      notes: s.notes ?? null,
      meeting_link: s.meeting_link ?? null,
      cancel_reason: s.cancel_reason ?? null,
      user1_id: s.user1_id,
      user2_id: s.user2_id,
      user1_name: profileMap.get(s.user1_id) || "Panther Student",
      user2_name: s.user2_id ? (profileMap.get(s.user2_id) || "Panther Student") : "Panther Student",
    }));
    setSessions(sessionList);

    // Load which sessions I already reviewed
    const { data: myRevs } = await supabase
      .from("reviews")
      .select("session_id")
      .eq("reviewer_id", user.id);
    setMyReviews(new Set((myRevs || []).map((r: any) => String(r.session_id))));

    /* accepted matches */
    const { data: matchRows } = await supabase
      .from("matches")
      .select("id, user1_id, user2_id, skill_id, status, skills(name)")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .eq("status", "accepted");

    if (matchRows && matchRows.length > 0) {
      const otherIds = matchRows.map((m: any) =>
        m.user1_id === user.id ? m.user2_id : m.user1_id
      );
      const { data: mp } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", otherIds);
      const nameMap = new Map<string, string>();
      for (const p of mp || []) nameMap.set(p.id, p.full_name || "Panther Student");

      const matches = matchRows.map((m: any) => {
        const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
        return {
          id: m.id,
          other_id: otherId,
          other_name: nameMap.get(otherId) || "Panther Student",
          skill_id: m.skill_id,
          skill_name: (m.skills as any)?.name || "Unknown",
        };
      });
      setAcceptedMatches(matches);

      if (skillParam && partnerId && !subject) {
        const hit = matches.find(
          (ma: any) => ma.other_id === partnerId && ma.skill_id === parseInt(skillParam)
        );
        if (hit) setSubject(hit.skill_name);
      }
    }
    setLoadingData(false);
  }

  /* ── busy-slot loader ── */
  async function loadBusySlots(
    partnerId: string,
    dateStr: string,
    excludeSessionId?: string
  ): Promise<{ partnerSlots: BusySlot[]; mySlots: BusySlot[] }> {
    if (!user) return { partnerSlots: [], mySlots: [] };
    const dayStart = `${dateStr}T00:00:00`;
    const dayEnd = `${dateStr}T23:59:59`;

    const [{ data: ps }, { data: ms }] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, scheduled_at, duration_minutes")
        .or(`user1_id.eq.${partnerId},user2_id.eq.${partnerId}`)
        .eq("status", "scheduled")
        .gte("scheduled_at", dayStart)
        .lte("scheduled_at", dayEnd),
      supabase
        .from("sessions")
        .select("id, scheduled_at, duration_minutes")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .eq("status", "scheduled")
        .gte("scheduled_at", dayStart)
        .lte("scheduled_at", dayEnd),
    ]);

    const toBusy = (rows: any[], exclude?: string): BusySlot[] =>
      (rows || [])
        .filter((s: any) => s.id.toString() !== exclude)
        .map((s: any) => ({
          start: new Date(s.scheduled_at),
          end: new Date(new Date(s.scheduled_at).getTime() + (s.duration_minutes || 60) * 60 * 1000),
        }));

    return {
      partnerSlots: toBusy(ps || [], excludeSessionId),
      mySlots: toBusy(ms || [], excludeSessionId),
    };
  }

  /* reload slots on partner / date / duration change */
  useEffect(() => {
    if (!selectedMatch || !date) {
      setPartnerBusy([]);
      setMyBusy([]);
      setTime("");
      return;
    }
    setTime("");
    setLoadingSlots(true);
    loadBusySlots(selectedMatch, date).then(({ partnerSlots, mySlots }) => {
      setPartnerBusy(partnerSlots);
      setMyBusy(mySlots);
      setLoadingSlots(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMatch, date, duration]);

  const timeSlots = useMemo(() => {
    if (!date) return [];
    return generateTimeSlots(date, duration, [...partnerBusy, ...myBusy]);
  }, [date, duration, partnerBusy, myBusy]);

  const editTimeSlots = useMemo(() => {
    if (!editDate) return [];
    return generateTimeSlots(editDate, editDuration, [...editBusy, ...editMyBusy]);
  }, [editDate, editDuration, editBusy, editMyBusy]);

  /* ── book ── */
  async function handleBookSession() {
    if (!user || !selectedMatch || !subject || !date || !time) return;
    if (meetingType === "in-person" && !location.trim()) {
      setErrorMsg("Please enter a room number or location for the in-person session.");
      return;
    }
    setBooking(true);
    setErrorMsg("");
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

    let meetingLink = "";
    if (meetingType === "zoom") {
      // Try to create a Zoom meeting, fall back to Jitsi if Zoom is not configured
      try {
        const zoomRes = await fetch("/api/zoom/create-meeting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: `PantherTutor: ${subject}`,
            duration,
            startTime: scheduledAt,
          }),
        });
        const zoomData = await zoomRes.json();
        if (zoomRes.ok && zoomData.join_url) {
          meetingLink = zoomData.join_url;
        }
      } catch {
        // Zoom unavailable — will fallback
      }
      if (!meetingLink) {
        const roomId = `PantherTutor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        meetingLink = `https://meet.jit.si/${roomId}`;
      }
    } else {
      // In-person — store location with prefix
      meetingLink = `in-person:${location.trim()}`;
    }

    const { error } = await supabase.from("sessions").insert({
      user1_id: selectedMatch,
      user2_id: user.id,
      subject,
      scheduled_at: scheduledAt,
      duration_minutes: duration,
      notes: notes || null,
      status: "scheduled",
      meeting_link: meetingLink,
    });

    if (error) {
      console.error("Book session error:", error);
      setErrorMsg(error.message || "Failed to book session. Please try again.");
      setBooking(false);
      return;
    }

    setBookingSuccess(true);
    setSubject("");
    setDate("");
    setTime("");
    setNotes("");
    setSelectedMatch("");
    setMeetingType("zoom");
    setLocation("");
    await fetchData();
    setTimeout(() => {
      setBookingSuccess(false);
      setActiveTab("upcoming");
    }, 2000);
    setBooking(false);
  }

  /* ── cancel ── */
  async function handleCancelSession() {
    if (!cancellingSession) return;
    setSavingCancel(true);
    await supabase
      .from("sessions")
      .update({ status: "cancelled", cancel_reason: cancelReason || null })
      .eq("id", cancellingSession.id);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === cancellingSession.id
          ? { ...s, status: "cancelled", cancel_reason: cancelReason || null }
          : s
      )
    );
    setCancellingSession(null);
    setCancelReason("");
    setSavingCancel(false);
  }

  /* ── complete ── */
  async function completeSession(sessionId: string) {
    await supabase.from("sessions").update({ status: "completed" }).eq("id", sessionId);
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === sessionId ? { ...s, status: "completed" } : s));
      // Auto-open review modal for the just-completed session
      const completed = updated.find((s) => s.id === sessionId);
      if (completed) {
        setReviewingSession(completed);
        setReviewRating(0);
        setReviewHover(0);
        setReviewText("");
        setReviewError("");
      }
      return updated;
    });
  }

  /* ── submit review ── */
  async function handleSubmitReview() {
    if (!reviewingSession || !user) return;
    if (reviewRating === 0) {
      setReviewError("Please select a star rating.");
      return;
    }
    if (reviewText.trim().length < 5) {
      setReviewError("Please write a review (at least 5 characters).");
      return;
    }
    setSavingReview(true);
    setReviewError("");

    const revieweeId = reviewingSession.user1_id === user.id
      ? reviewingSession.user2_id
      : reviewingSession.user1_id;

    // user1_id = tutor, user2_id = student (booking convention)
    const revieweeRole = revieweeId === reviewingSession.user1_id ? "tutor" : "student";

    const { error } = await supabase.from("reviews").insert({
      session_id: reviewingSession.id,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      reviewee_role: revieweeRole,
      rating: reviewRating,
      review_text: reviewText.trim(),
    });

    if (error) {
      if (error.message?.includes("duplicate") || error.code === "23505") {
        setReviewError("You already reviewed this session.");
      } else {
        setReviewError(error.message || "Failed to submit review.");
      }
      setSavingReview(false);
      return;
    }

    setMyReviews((prev) => new Set(prev).add(String(reviewingSession.id)));
    setReviewingSession(null);
    setSavingReview(false);
  }

  /* ── edit modal open ── */
  async function openEditModal(session: SessionData) {
    setEditingSession(session);
    const dt = new Date(session.scheduled_at);
    const dateStr = toLocalDateStr(dt);
    setEditDate(dateStr);
    setEditTime(`${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`);
    setEditDuration(session.duration_minutes);
    setEditNotes(session.notes || "");
    setEditReason("");

    const otherId = session.user1_id === user?.id ? session.user2_id : session.user1_id;
    setLoadingEditSlots(true);
    const { partnerSlots, mySlots } = await loadBusySlots(otherId, dateStr, session.id);
    setEditBusy(partnerSlots);
    setEditMyBusy(mySlots);
    setLoadingEditSlots(false);
  }

  /* reload edit busy when date / duration changes */
  useEffect(() => {
    if (!editingSession || !editDate) return;
    const otherId =
      editingSession.user1_id === user?.id ? editingSession.user2_id : editingSession.user1_id;
    setLoadingEditSlots(true);
    loadBusySlots(otherId, editDate, editingSession.id).then(({ partnerSlots, mySlots }) => {
      setEditBusy(partnerSlots);
      setEditMyBusy(mySlots);
      setLoadingEditSlots(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editDate, editDuration]);

  /* ── save edit ── */
  async function handleSaveEdit() {
    if (!editingSession || !editDate || !editTime) return;
    setSavingEdit(true);
    const scheduledAt = new Date(`${editDate}T${editTime}:00`).toISOString();

    await supabase
      .from("sessions")
      .update({
        scheduled_at: scheduledAt,
        duration_minutes: editDuration,
        notes: editNotes || null,
      })
      .eq("id", editingSession.id);

    setSessions((prev) =>
      prev.map((s) =>
        s.id === editingSession.id
          ? { ...s, scheduled_at: scheduledAt, duration_minutes: editDuration, notes: editNotes || null }
          : s
      )
    );
    setEditingSession(null);
    setSavingEdit(false);
  }

  /* ── loading screen ── */
  if (loading || !user || loadingData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" style={{ width: 40, height: 40, border: "3px solid var(--border-color)", borderTopColor: "var(--gsu-blue)", borderRadius: "50%" }} />
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

  const availableCount = timeSlots.filter((s) => s.available).length;
  const unavailableCount = timeSlots.filter((s) => !s.available).length;

  /* ═════════════ RENDER ═════════════ */
  return (
    <div style={{ minHeight: "100vh", padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div className="fade-in" style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, marginBottom: "0.25rem" }}>
            <span className="gradient-text">Sessions</span> 📅
          </h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>Schedule and manage your tutoring sessions.</p>
        </div>

        {/* Tabs */}
        <div className="fade-in fade-in-delay-1" style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border-color)", overflowX: "auto" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "0.75rem 1.25rem", border: "none", background: "none", cursor: "pointer",
                fontWeight: 600, fontSize: "0.95rem",
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
          {/* ═══ UPCOMING ═══ */}
          {activeTab === "upcoming" && (
            <div>
              {upcoming.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", cursor: "default" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📅</div>
                  <h3 style={{ marginBottom: "0.5rem" }}>No Upcoming Sessions</h3>
                  <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                    Book a session with one of your matches to get started.
                  </p>
                  <button className="btn-primary" style={{ padding: "0.5rem 1.5rem", borderRadius: "10px", cursor: "pointer" }} onClick={() => setActiveTab("book")}>
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
                      onCancel={() => setCancellingSession(session)}
                      onComplete={() => completeSession(session.id)}
                      onEdit={() => openEditModal(session)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ PAST ═══ */}
          {activeTab === "past" && (
            <div>
              {past.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", cursor: "default" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📋</div>
                  <h3>No Session History</h3>
                  <p style={{ color: "var(--text-muted)" }}>Your completed and past sessions will appear here.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {past.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      userId={user.id}
                      statusColors={statusColors}
                      onReview={
                        session.status === "completed" && !myReviews.has(String(session.id))
                          ? () => {
                              setReviewingSession(session);
                              setReviewRating(0);
                              setReviewHover(0);
                              setReviewText("");
                              setReviewError("");
                            }
                          : undefined
                      }
                      reviewed={myReviews.has(String(session.id))}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ BOOK ═══ */}
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
                  <a href="/matches" className="btn-primary" style={{ padding: "0.5rem 1.5rem", borderRadius: "10px", textDecoration: "none" }}>
                    Find Matches
                  </a>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Book a Tutoring Session</h3>

                  {errorMsg && (
                    <div style={{ background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.3)", borderRadius: "8px", padding: "0.75rem 1rem", color: "var(--gsu-red)", fontSize: "0.9rem" }}>
                      {errorMsg}
                    </div>
                  )}

                  {/* Partner */}
                  <div className="input-group">
                    <label className="label">Study Partner</label>
                    <select
                      className="input"
                      value={selectedMatch}
                      onChange={(e) => {
                        setSelectedMatch(e.target.value);
                        const match = acceptedMatches.find((m) => m.other_id === e.target.value);
                        if (match && !subject) setSubject(match.skill_name);
                      }}
                    >
                      <option value="">Select a partner...</option>
                      {acceptedMatches.map((m) => (
                        <option key={`${m.other_id}_${m.skill_id}`} value={m.other_id}>
                          {m.other_name} — {m.skill_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subject */}
                  <div className="input-group">
                    <label className="label">Subject</label>
                    <input className="input" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Calculus I, Data Structures" />
                    {selectedMatch && (() => {
                      const pm = acceptedMatches.filter((m) => m.other_id === selectedMatch);
                      return pm.length > 0 ? (
                        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                          {pm.map((m) => (
                            <button
                              key={m.skill_id}
                              onClick={() => setSubject(m.skill_name)}
                              className="badge badge-blue"
                              style={{ cursor: "pointer", border: subject === m.skill_name ? "2px solid var(--gsu-blue)" : "none" }}
                            >
                              {m.skill_name}
                            </button>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Duration */}
                  <div className="input-group">
                    <label className="label">Duration</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {[30, 60, 90, 120].map((d) => (
                        <button
                          key={d}
                          onClick={() => setDuration(d)}
                          style={{
                            padding: "0.5rem 1rem", borderRadius: "999px", fontSize: "0.9rem",
                            border: duration === d ? "2px solid var(--gsu-blue)" : "1px solid var(--border-color)",
                            background: duration === d ? "rgba(0,57,166,0.1)" : "var(--bg-secondary)",
                            color: duration === d ? "var(--gsu-blue)" : "var(--text-secondary)",
                            cursor: "pointer", fontWeight: duration === d ? 600 : 400,
                            transition: "all 0.2s ease",
                          }}
                        >
                          {d} min
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date */}
                  <div className="input-group">
                    <label className="label">Date</label>
                    <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
                  </div>

                  {/* Time grid */}
                  {date && selectedMatch && (
                    <div className="input-group">
                      <label className="label">
                        Available Times{" "}
                        {loadingSlots ? (
                          <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(loading...)</span>
                        ) : (
                          <span style={{ fontWeight: 400, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            ({availableCount} open{unavailableCount > 0 && `, ${unavailableCount} busy`})
                          </span>
                        )}
                      </label>

                      {!loadingSlots && timeSlots.length === 0 ? (
                        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                          No available slots for this date. Try another day.
                        </p>
                      ) : !loadingSlots ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "0.375rem" }}>
                          {timeSlots.map((slot) => (
                            <button
                              key={slot.time}
                              disabled={!slot.available}
                              onClick={() => setTime(slot.time)}
                              style={{
                                padding: "0.5rem 0.25rem", borderRadius: "8px", fontSize: "0.8rem",
                                fontWeight: time === slot.time ? 700 : 500,
                                border: time === slot.time ? "2px solid var(--gsu-blue)" : slot.available ? "1px solid var(--border-color)" : "1px solid transparent",
                                background: !slot.available ? "rgba(204,0,0,0.06)" : time === slot.time ? "rgba(0,57,166,0.1)" : "var(--bg-secondary)",
                                color: !slot.available ? "var(--text-muted)" : time === slot.time ? "var(--gsu-blue)" : "var(--text-primary)",
                                cursor: slot.available ? "pointer" : "not-allowed",
                                textDecoration: !slot.available ? "line-through" : "none",
                                transition: "all 0.15s ease", opacity: !slot.available ? 0.5 : 1,
                              }}
                            >
                              {slot.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Meeting Type */}
                  <div className="input-group">
                    <label className="label">Meeting Type</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {(["zoom", "in-person"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => { setMeetingType(t); if (t === "zoom") setLocation(""); }}
                          style={{
                            padding: "0.5rem 1.25rem", borderRadius: "999px", fontSize: "0.9rem",
                            border: meetingType === t ? "2px solid var(--gsu-blue)" : "1px solid var(--border-color)",
                            background: meetingType === t ? "rgba(0,57,166,0.1)" : "var(--bg-secondary)",
                            color: meetingType === t ? "var(--gsu-blue)" : "var(--text-secondary)",
                            cursor: "pointer", fontWeight: meetingType === t ? 600 : 400,
                            transition: "all 0.2s ease",
                          }}
                        >
                          {t === "zoom" ? "🎥 Via Zoom" : "📍 In Person"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Location (in-person only) */}
                  {meetingType === "in-person" && (
                    <div className="input-group">
                      <label className="label">Location / Room Number</label>
                      <input
                        className="input"
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Library Room 203, Student Center 2nd Floor"
                      />
                    </div>
                  )}

                  {/* Notes */}
                  <div className="input-group">
                    <label className="label">Notes (optional)</label>
                    <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Topics to cover, questions to ask..." style={{ resize: "vertical" }} />
                  </div>

                  <button
                    className="btn-primary"
                    onClick={handleBookSession}
                    disabled={booking || !selectedMatch || !subject || !date || !time}
                    style={{
                      padding: "0.75rem", borderRadius: "10px",
                      cursor: booking || !selectedMatch || !subject || !date || !time ? "not-allowed" : "pointer",
                      opacity: booking || !selectedMatch || !subject || !date || !time ? 0.5 : 1,
                    }}
                  >
                    {booking ? "Booking..." : "📅 Book Session"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ CANCEL MODAL ═══ */}
      {cancellingSession && (
        <ModalOverlay onClose={() => setCancellingSession(null)}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.25rem" }}>Cancel Session</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
            Cancel your session for <strong>{cancellingSession.subject || "Tutoring"}</strong> on{" "}
            {new Date(cancellingSession.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}?
          </p>
          <div className="input-group" style={{ marginBottom: "1rem" }}>
            <label className="label">Reason (optional)</label>
            <textarea className="input" rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Schedule conflict, feeling sick..." style={{ resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button onClick={() => setCancellingSession(null)} style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", cursor: "pointer", fontWeight: 600, color: "var(--text-primary)" }}>
              Keep Session
            </button>
            <button onClick={handleCancelSession} disabled={savingCancel} style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", border: "none", background: "var(--gsu-red)", color: "white", cursor: savingCancel ? "wait" : "pointer", fontWeight: 600 }}>
              {savingCancel ? "Cancelling..." : "✕ Cancel Session"}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ═══ EDIT MODAL ═══ */}
      {editingSession && (
        <ModalOverlay onClose={() => setEditingSession(null)}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            Edit Session — {editingSession.subject || "Tutoring"}
          </h3>

          {/* Duration */}
          <div className="input-group" style={{ marginBottom: "0.75rem" }}>
            <label className="label">Duration</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {[30, 60, 90, 120].map((d) => (
                <button key={d} onClick={() => { setEditDuration(d); setEditTime(""); }} style={{
                  padding: "0.4rem 0.75rem", borderRadius: "999px", fontSize: "0.8rem",
                  border: editDuration === d ? "2px solid var(--gsu-blue)" : "1px solid var(--border-color)",
                  background: editDuration === d ? "rgba(0,57,166,0.1)" : "var(--bg-secondary)",
                  color: editDuration === d ? "var(--gsu-blue)" : "var(--text-secondary)",
                  cursor: "pointer", fontWeight: editDuration === d ? 600 : 400,
                }}>
                  {d} min
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="input-group" style={{ marginBottom: "0.75rem" }}>
            <label className="label">Date</label>
            <input className="input" type="date" value={editDate} onChange={(e) => { setEditDate(e.target.value); setEditTime(""); }} min={new Date().toISOString().split("T")[0]} />
          </div>

          {/* Time grid */}
          {editDate && (
            <div className="input-group" style={{ marginBottom: "0.75rem" }}>
              <label className="label">
                Time {loadingEditSlots && <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(loading...)</span>}
              </label>
              {!loadingEditSlots && editTimeSlots.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(85px, 1fr))", gap: "0.375rem", maxHeight: 200, overflowY: "auto" }}>
                  {editTimeSlots.map((slot) => (
                    <button key={slot.time} disabled={!slot.available} onClick={() => setEditTime(slot.time)} style={{
                      padding: "0.4rem 0.25rem", borderRadius: "8px", fontSize: "0.8rem",
                      fontWeight: editTime === slot.time ? 700 : 500,
                      border: editTime === slot.time ? "2px solid var(--gsu-blue)" : slot.available ? "1px solid var(--border-color)" : "1px solid transparent",
                      background: !slot.available ? "rgba(204,0,0,0.06)" : editTime === slot.time ? "rgba(0,57,166,0.1)" : "var(--bg-secondary)",
                      color: !slot.available ? "var(--text-muted)" : editTime === slot.time ? "var(--gsu-blue)" : "var(--text-primary)",
                      cursor: slot.available ? "pointer" : "not-allowed",
                      textDecoration: !slot.available ? "line-through" : "none",
                      opacity: !slot.available ? 0.5 : 1,
                    }}>
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="input-group" style={{ marginBottom: "0.75rem" }}>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} style={{ resize: "vertical" }} />
          </div>

          {/* Reason */}
          <div className="input-group" style={{ marginBottom: "1rem" }}>
            <label className="label">Reason for change (optional)</label>
            <input className="input" type="text" value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="e.g. Conflict with another class..." />
          </div>

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button onClick={() => setEditingSession(null)} style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", cursor: "pointer", fontWeight: 600, color: "var(--text-primary)" }}>
              Discard
            </button>
            <button onClick={handleSaveEdit} disabled={savingEdit || !editDate || !editTime} className="btn-primary" style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", cursor: savingEdit || !editDate || !editTime ? "not-allowed" : "pointer", opacity: savingEdit || !editDate || !editTime ? 0.5 : 1 }}>
              {savingEdit ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ═══ REVIEW MODAL ═══ */}
      {reviewingSession && (() => {
        const revieweeName = reviewingSession.user1_id === user.id ? reviewingSession.user2_name : reviewingSession.user1_name;
        const revieweeRole = reviewingSession.user1_id === user.id ? "student" : "tutor";
        return (
        <ModalOverlay onClose={() => setReviewingSession(null)}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.25rem" }}>⭐ Rate {revieweeName} as a {revieweeRole === "tutor" ? "Tutor" : "Student"}</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
            How was your <strong>{reviewingSession.subject || "tutoring"}</strong> session?
            {revieweeRole === "tutor"
              ? " Rate their teaching & explanation skills."
              : " Rate their engagement & participation."}
          </p>

          {reviewError && (
            <div style={{ background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.3)", borderRadius: "8px", padding: "0.6rem 0.9rem", color: "var(--gsu-red)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              {reviewError}
            </div>
          )}

          {/* Star Rating */}
          <div style={{ marginBottom: "1rem" }}>
            <label className="label" style={{ marginBottom: "0.5rem", display: "block" }}>Rating <span style={{ color: "var(--gsu-red)" }}>*</span></label>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  onMouseEnter={() => setReviewHover(star)}
                  onMouseLeave={() => setReviewHover(0)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: "2rem", padding: "0.1rem",
                    color: star <= (reviewHover || reviewRating) ? "#f59e0b" : "var(--border-color)",
                    transition: "color 0.15s, transform 0.15s",
                    transform: star <= (reviewHover || reviewRating) ? "scale(1.15)" : "scale(1)",
                  }}
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              ))}
              {reviewRating > 0 && (
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", alignSelf: "center", marginLeft: "0.5rem" }}>
                  {["", "Poor", "Fair", "Good", "Great", "Excellent"][reviewRating]}
                </span>
              )}
            </div>
          </div>

          {/* Written Review */}
          <div className="input-group" style={{ marginBottom: "1rem" }}>
            <label className="label">Review <span style={{ color: "var(--gsu-red)" }}>*</span></label>
            <textarea
              className="input"
              rows={3}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="What went well? How was the tutoring experience?"
              style={{ resize: "vertical" }}
              maxLength={1000}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.25rem" }}>
              <span style={{ fontSize: "0.75rem", color: reviewText.trim().length < 5 ? "var(--gsu-red)" : "var(--text-muted)" }}>
                Min 5 characters
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {reviewText.length}/1000
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button onClick={() => setReviewingSession(null)} style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", cursor: "pointer", fontWeight: 600, color: "var(--text-primary)" }}>
              Skip
            </button>
            <button
              onClick={handleSubmitReview}
              disabled={savingReview || reviewRating === 0 || reviewText.trim().length < 5}
              className="btn-primary"
              style={{
                padding: "0.5rem 1.25rem", borderRadius: "8px",
                cursor: savingReview || reviewRating === 0 || reviewText.trim().length < 5 ? "not-allowed" : "pointer",
                opacity: savingReview || reviewRating === 0 || reviewText.trim().length < 5 ? 0.5 : 1,
              }}
            >
              {savingReview ? "Submitting..." : "⭐ Submit Review"}
            </button>
          </div>
        </ModalOverlay>
        );
      })()}
    </div>
  );
}

/* ═══ Modal Overlay ═══ */
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ cursor: "default", maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

/* ═══ Session Card ═══ */
function SessionCard({
  session, userId, statusColors, onCancel, onComplete, onEdit, onReview, reviewed,
}: {
  session: SessionData;
  userId: string;
  statusColors: Record<string, string>;
  onCancel?: () => void;
  onComplete?: () => void;
  onEdit?: () => void;
  onReview?: () => void;
  reviewed?: boolean;
}) {
  const isUpcoming = session.status === "scheduled" && new Date(session.scheduled_at) >= new Date();
  const otherName = session.user1_id === userId ? session.user2_name : session.user1_name;
  const role = session.user1_id === userId ? "Tutoring" : "Learning from";

  return (
    <div className="card" style={{ cursor: "default", borderLeft: `4px solid ${statusColors[session.status] || "var(--border-color)"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{session.subject || "Tutoring Session"}</div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
            {role} <strong>{otherName}</strong>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            📅 {new Date(session.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at{" "}
            {new Date(session.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {session.duration_minutes} min
          </div>
          {session.notes && (
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem", fontStyle: "italic" }}>
              &quot;{session.notes}&quot;
            </div>
          )}
          {session.cancel_reason && session.status === "cancelled" && (
            <div style={{ fontSize: "0.8rem", color: "var(--gsu-red)", marginTop: "0.5rem" }}>
              Reason: {session.cancel_reason}
            </div>
          )}
          {isUpcoming && session.meeting_link && (
            session.meeting_link.startsWith("in-person:") ? (
              <div
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.4rem",
                  marginTop: "0.5rem", padding: "0.4rem 0.9rem",
                  background: "rgba(0,57,166,0.1)", color: "var(--gsu-blue)",
                  borderRadius: "8px", fontSize: "0.8rem", fontWeight: 700,
                }}
              >
                📍 {session.meeting_link.replace("in-person:", "")}
              </div>
            ) : (
              <a
                href={session.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.4rem",
                  marginTop: "0.5rem", padding: "0.4rem 0.9rem",
                  background: "#16a34a", color: "white",
                  borderRadius: "8px", fontSize: "0.8rem", fontWeight: 700,
                  textDecoration: "none", transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                🎥 Join Meeting
              </a>
            )
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
          <span className="badge" style={{ background: statusColors[session.status] + "18", color: statusColors[session.status], border: `1px solid ${statusColors[session.status]}30` }}>
            {session.status}
          </span>
          {isUpcoming && onCancel && onComplete && onEdit && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button style={{ background: "rgba(0,57,166,0.08)", color: "var(--gsu-blue)", border: "1px solid rgba(0,57,166,0.2)", padding: "0.25rem 0.75rem", fontSize: "0.8rem", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }} onClick={onEdit}>
                ✎ Edit
              </button>
              <button style={{ background: "#16a34a15", color: "#16a34a", border: "1px solid #16a34a30", padding: "0.25rem 0.75rem", fontSize: "0.8rem", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }} onClick={onComplete}>
                ✓ Complete
              </button>
              <button style={{ background: "rgba(204,0,0,0.06)", color: "var(--gsu-red)", border: "1px solid rgba(204,0,0,0.2)", padding: "0.25rem 0.75rem", fontSize: "0.8rem", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }} onClick={onCancel}>
                ✕ Cancel
              </button>
            </div>
          )}
          {session.status === "completed" && (
            <div>
              {onReview ? (
                <button
                  onClick={onReview}
                  style={{
                    background: "rgba(245,158,11,0.1)", color: "#d97706",
                    border: "1px solid rgba(245,158,11,0.3)",
                    padding: "0.25rem 0.75rem", fontSize: "0.8rem",
                    borderRadius: "8px", cursor: "pointer", fontWeight: 600,
                  }}
                >
                  ⭐ Rate
                </button>
              ) : reviewed ? (
                <span style={{ fontSize: "0.78rem", color: "#16a34a", fontWeight: 600 }}>
                  ✓ Reviewed
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ Page wrapper ═══ */
export default function SessionsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" style={{ width: 40, height: 40, border: "3px solid var(--border-color)", borderTopColor: "var(--gsu-blue)", borderRadius: "50%" }} />
      </div>
    }>
      <SessionsContent />
    </Suspense>
  );
}
