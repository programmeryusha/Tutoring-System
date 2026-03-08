"use client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Profile {
  full_name: string | null;
  bio: string | null;
  major: string | null;
  year: string | null;
}

interface Session {
  id: string;
  subject: string;
  scheduled_at: string;
  status: string;
  tutor_id: string;
  student_id: string;
  tutor_profile?: { full_name: string };
  student_profile?: { full_name: string };
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [skillCount, setSkillCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      // Fetch profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, bio, major, year")
        .eq("id", user!.id)
        .single();
      setProfile(prof);

      // Fetch upcoming sessions
      const { data: sess } = await supabase
        .from("sessions")
        .select("id, subject, scheduled_at, status, tutor_id, student_id")
        .or(`tutor_id.eq.${user!.id},student_id.eq.${user!.id}`)
        .eq("status", "scheduled")
        .order("scheduled_at", { ascending: true })
        .limit(5);
      setSessions(sess || []);

      // Fetch skill count
      const { count: sc } = await supabase
        .from("user_skills")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);
      setSkillCount(sc || 0);

      // Fetch match count
      const { count: mc } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .or(`user1_id.eq.${user!.id},user2_id.eq.${user!.id}`);
      setMatchCount(mc || 0);
    }

    fetchData();
  }, [user]);

  if (loading || !user) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div className="animate-spin" style={{
          width: 40,
          height: 40,
          border: "3px solid var(--border-color)",
          borderTopColor: "var(--gsu-blue)",
          borderRadius: "50%",
        }} />
      </div>
    );
  }

  const displayName = profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Student";
  const greeting = getGreeting();

  const quickActions = [
    { href: "/profile", icon: "👤", title: "Edit Profile", desc: "Update skills & info", color: "var(--gsu-blue)" },
    { href: "/matches", icon: "🤝", title: "Find Matches", desc: "AI-powered matching", color: "var(--gsu-red)" },
    { href: "/sessions", icon: "📅", title: "Book Session", desc: "Schedule tutoring", color: "#16a34a" },
    { href: "/about", icon: "ℹ️", title: "About", desc: "Meet the team", color: "#8b5cf6" },
  ];

  const statCards = [
    { value: skillCount.toString(), label: "Skills Added", icon: "🎯" },
    { value: matchCount.toString(), label: "Matches Found", icon: "🤝" },
    { value: sessions.length.toString(), label: "Upcoming Sessions", icon: "📅" },
  ];

  return (
    <div style={{ minHeight: "100vh", padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Welcome Header */}
        <div className="fade-in" style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, marginBottom: "0.25rem" }}>
            {greeting}, <span className="gradient-text">{displayName}</span> 👋
          </h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            {!profile?.major
              ? "Complete your profile to get started with AI matching."
              : "Here's what's happening with your tutoring."}
          </p>
        </div>

        {/* Profile Completion Banner */}
        {(!profile?.major || skillCount === 0) && (
          <div
            className="fade-in fade-in-delay-1"
            style={{
              padding: "1.25rem 1.5rem",
              background: "linear-gradient(135deg, rgba(0,57,166,0.08), rgba(204,0,0,0.05))",
              border: "1px solid rgba(0,57,166,0.15)",
              borderRadius: "var(--radius-lg)",
              marginBottom: "2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <p style={{ fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                🎯 Complete your profile to unlock AI matching
              </p>
              <p style={{ color: "var(--text-muted)", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
                Add your skills and weaknesses so we can find your perfect study partner.
              </p>
            </div>
            <Link href="/profile" className="btn btn-primary btn-sm">
              Complete Profile →
            </Link>
          </div>
        )}

        {/* Stats Row */}
        <div
          className="fade-in fade-in-delay-2"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                cursor: "default",
              }}
            >
              <div style={{
                width: 48,
                height: 48,
                borderRadius: "var(--radius-md)",
                background: "var(--bg-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
              }}>
                {stat.icon}
              </div>
              <div>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <h3 className="fade-in fade-in-delay-3" style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>
          Quick Actions
        </h3>
        <div
          className="fade-in fade-in-delay-3"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "1rem",
            marginBottom: "2.5rem",
          }}
        >
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="card card-glow"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                textDecoration: "none",
                borderLeft: `4px solid ${action.color}`,
              }}
            >
              <div style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-md)",
                background: "var(--bg-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.3rem",
              }}>
                {action.icon}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {action.title}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  {action.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Upcoming Sessions */}
        <h3 className="fade-in fade-in-delay-4" style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>
          Upcoming Sessions
        </h3>
        <div className="fade-in fade-in-delay-4">
          {sessions.length === 0 ? (
            <div className="card" style={{
              textAlign: "center",
              padding: "3rem 2rem",
              cursor: "default",
            }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📅</div>
              <p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                No upcoming sessions
              </p>
              <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                Find a match and book your first tutoring session!
              </p>
              <Link href="/matches" className="btn btn-primary btn-sm">
                Find Matches
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderLeft: "4px solid var(--gsu-blue)",
                    cursor: "default",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{session.subject}</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      {new Date(session.scheduled_at).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <span className="badge badge-blue">{session.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
