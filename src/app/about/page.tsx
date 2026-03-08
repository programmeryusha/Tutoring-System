"use client";

const team = [
  {
    name: "Kerim Shamyradov",
    role: "Full Stack Developer",
    bio: "Expert in React and Node.js ecosystems. Leads the architecture and full-stack development.",
    avatar: "/avatars/po.webp",
    github: "#",
    color: "var(--gsu-blue)",
  },
  {
    name: "Yusha Syed",
    role: "Full Stack Developer",
    bio: "Passionate about building scalable web applications and seamless user experiences. Focuses on API design, data flow, and frontend-backend integration.",
    avatar: "/avatars/crane.webp",
    github: "#",
    color: "var(--gsu-red)",
  },
  {
    name: "Kevin Fish",
    role: "Web Design",
    bio: "Creative designer with an eye for modern aesthetics. Crafts the visual identity, UI components, and responsive layouts.",
    avatar: "/avatars/monkey.webp",
    github: "#",
    color: "#16a34a",
  },
  {
    name: "Celine Alnawajha",
    role: "Systems & UX Integration",
    bio: "Bridges the gap between design and engineering. Ensures accessibility, smooth workflows, and intuitive user journeys.",
    avatar: "/avatars/tigress.webp",
    github: "#",
    color: "#8b5cf6",
  },
  {
    name: "Hasan Unal",
    role: "Backend & Coordination",
    bio: "Database architect and team coordinator. Manages Supabase infrastructure, sprint planning, and backend logic.",
    avatar: "/avatars/shifu.webp",
    github: "#",
    color: "#f59e0b",
  },
];

const techStack = [
  { name: "Next.js 16", icon: "⚡" },
  { name: "React 19", icon: "⚛️" },
  { name: "TypeScript", icon: "🔷" },
  { name: "Supabase", icon: "🟢" },
  { name: "TailwindCSS 4", icon: "🎨" },
  { name: "PostgreSQL", icon: "🐘" },
];

export default function AboutPage() {
  return (
    <div style={{ minHeight: "100vh", padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* Hero */}
        <div className="fade-in" style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{
            display: "inline-block",
            padding: "0.35rem 1rem",
            borderRadius: "var(--radius-full)",
            background: "rgba(0,57,166,0.08)",
            border: "1px solid rgba(0,57,166,0.15)",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--gsu-blue)",
            marginBottom: "1rem",
          }}>
            🐾 Georgia State University
          </div>
          <h1 style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 800, marginBottom: "0.75rem" }}>
            Meet the <span className="gradient-text">Team</span>
          </h1>
          <p style={{ color: "var(--text-muted)", maxWidth: 600, margin: "0 auto", fontSize: "1.05rem", lineHeight: 1.7 }}>
            We&apos;re a team of GSU students building PantherTutor to make
            peer-to-peer learning more accessible and effective for everyone.
          </p>
        </div>

        {/* Team Grid */}
        <div
          className="fade-in fade-in-delay-1"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1.5rem",
            marginBottom: "4rem",
          }}
        >
          {team.map((member, i) => (
            <div
              key={member.name}
              className={`card card-glow fade-in fade-in-delay-${Math.min(i + 1, 5)}`}
              style={{
                cursor: "default",
                textAlign: "center",
                padding: "2rem 1.5rem",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Accent bar */}
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: `linear-gradient(90deg, ${member.color}, transparent)`,
              }} />

              {/* Avatar */}
              <div style={{
                width: 90,
                height: 90,
                borderRadius: "50%",
                margin: "0 auto 1rem",
                overflow: "hidden",
                border: `3px solid ${member.color}30`,
                boxShadow: `0 0 20px ${member.color}15`,
              }}>
                <img
                  src={member.avatar}
                  alt={member.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                />
              </div>

              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                {member.name}
              </h3>
              <div style={{
                display: "inline-block",
                padding: "0.2rem 0.75rem",
                borderRadius: "var(--radius-full)",
                background: `${member.color}12`,
                color: member.color,
                fontSize: "0.8rem",
                fontWeight: 600,
                marginBottom: "0.75rem",
              }}>
                {member.role}
              </div>
              <p style={{
                color: "var(--text-muted)",
                fontSize: "0.85rem",
                lineHeight: 1.6,
                margin: 0,
              }}>
                {member.bio}
              </p>
            </div>
          ))}
        </div>

        {/* Mission */}
        <div className="fade-in fade-in-delay-3" style={{
          textAlign: "center",
          marginBottom: "3rem",
          padding: "2.5rem 2rem",
          background: "linear-gradient(135deg, rgba(0,57,166,0.05), rgba(204,0,0,0.03))",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-color)",
        }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>
            Our <span className="gradient-text">Mission</span>
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: 650, margin: "0 auto", lineHeight: 1.8 }}>
            PantherTutor empowers Georgia State University students to learn from each other
            through AI-powered matching. We believe the best learning happens when students
            teach and support one another — turning every strength into someone else&apos;s opportunity
            to grow.
          </p>
        </div>

        {/* Tech Stack */}
        <div className="fade-in fade-in-delay-4" style={{ marginBottom: "3rem" }}>
          <h3 style={{ textAlign: "center", fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.25rem" }}>
            Built With
          </h3>
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}>
            {techStack.map((tech) => (
              <div
                key={tech.name}
                className="card"
                style={{
                  cursor: "default",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 1rem",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                }}
              >
                <span>{tech.icon}</span>
                {tech.name}
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="fade-in fade-in-delay-5" style={{
          textAlign: "center",
          padding: "1.5rem",
          color: "var(--text-muted)",
          fontSize: "0.85rem",
        }}>
          <p>Software Engineering — Spring 2026 — Georgia State University</p>
        </div>
      </div>
    </div>
  );
}
