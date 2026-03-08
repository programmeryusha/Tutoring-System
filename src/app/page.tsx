"use client";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const features = [
  {
    icon: "🤖",
    title: "AI-Powered Matching",
    desc: "Our smart algorithm pairs you with tutors whose strengths match your weaknesses — and vice versa.",
  },
  {
    icon: "📅",
    title: "Smart Scheduling",
    desc: "Built-in calendar system to book, manage, and track your tutoring sessions effortlessly.",
  },
  {
    icon: "📊",
    title: "Progress Tracking",
    desc: "Monitor your growth across subjects with visual progress indicators and session history.",
  },
  {
    icon: "⭐",
    title: "Rating System",
    desc: "Rate your sessions and find top-rated tutors based on real student feedback.",
  },
  {
    icon: "💬",
    title: "Integrated Communication",
    desc: "Connect with your tutor through built-in messaging and video calling.",
  },
  {
    icon: "🎓",
    title: "Certification System",
    desc: "Prove your expertise by earning certifications through proficiency assessments.",
  },
];

const stats = [
  { value: "500+", label: "Active Students" },
  { value: "50+", label: "Subjects Covered" },
  { value: "1,000+", label: "Sessions Completed" },
  { value: "4.8/5", label: "Average Rating" },
];

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
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

  return (
    <div style={{ overflow: "hidden" }}>
      {/* Hero Section */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        padding: "6rem 1.5rem 4rem",
      }}>
        {/* Background decoration */}
        <div style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,57,166,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute",
          bottom: "-10%",
          left: "-10%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(204,0,0,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{
          maxWidth: 900,
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}>
          <div className="fade-in" style={{ marginBottom: "1.5rem" }}>
            <span className="badge badge-blue" style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}>
              🐾 Georgia State University
            </span>
          </div>

          <h1
            className="fade-in fade-in-delay-1"
            style={{
              fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
              fontWeight: 900,
              lineHeight: 1.1,
              marginBottom: "1.5rem",
              letterSpacing: "-0.03em",
            }}
          >
            Learn Together,{" "}
            <span className="gradient-text-animated">Grow Together</span>
          </h1>

          <p
            className="fade-in fade-in-delay-2"
            style={{
              fontSize: "clamp(1.1rem, 2vw, 1.35rem)",
              maxWidth: 650,
              margin: "0 auto 2.5rem",
              color: "var(--text-secondary)",
              lineHeight: 1.7,
            }}
          >
            PantherTutor connects GSU students for peer-to-peer tutoring with
            AI-powered matching. Find the perfect study partner based on your
            strengths and weaknesses.
          </p>

          <div
            className="fade-in fade-in-delay-3"
            style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link href="/register" className="btn btn-primary btn-lg">
              Get Started Free →
            </Link>
            <Link href="/about" className="btn btn-secondary btn-lg">
              Meet the Team
            </Link>
          </div>

          {/* Stats */}
          <div
            className="fade-in fade-in-delay-4"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "2rem",
              marginTop: "5rem",
              padding: "2rem",
              background: "var(--bg-card)",
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--border-color)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {stats.map((stat) => (
              <div key={stat.label} style={{ textAlign: "center" }}>
                <div
                  className="gradient-text"
                  style={{
                    fontSize: "2rem",
                    fontWeight: 800,
                    lineHeight: 1.2,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-muted)",
                    marginTop: "0.25rem",
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{
        padding: "6rem 1.5rem",
        maxWidth: 1200,
        margin: "0 auto",
      }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <h2
            className="animate-on-scroll"
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
              fontWeight: 800,
              marginBottom: "1rem",
            }}
          >
            Everything you need to{" "}
            <span className="gradient-text">succeed</span>
          </h2>
          <p
            className="animate-on-scroll"
            style={{
              maxWidth: 600,
              margin: "0 auto",
              fontSize: "1.1rem",
            }}
          >
            Our platform is built with powerful features designed to make
            peer-to-peer tutoring seamless and effective.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`card card-glow animate-on-scroll animate-delay-${i + 1}`}
              style={{
                padding: "2rem",
                cursor: "default",
              }}
            >
              <div
                style={{
                  fontSize: "2.5rem",
                  marginBottom: "1rem",
                  width: 60,
                  height: 60,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius-lg)",
                }}
              >
                {feature.icon}
              </div>
              <h3 style={{ marginBottom: "0.5rem", fontSize: "1.2rem" }}>
                {feature.title}
              </h3>
              <p style={{ fontSize: "0.95rem", margin: 0 }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: "6rem 1.5rem",
        textAlign: "center",
      }}>
        <div
          className="animate-on-scroll"
          style={{
            maxWidth: 800,
            margin: "0 auto",
            padding: "4rem 3rem",
            background: "linear-gradient(135deg, var(--gsu-blue), var(--gsu-blue-dark))",
            borderRadius: "var(--radius-xl)",
            color: "white",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{
            position: "absolute",
            top: "-50%",
            right: "-20%",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            pointerEvents: "none",
          }} />
          <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "1rem", color: "white" }}>
            Ready to ace your classes?
          </h2>
          <p style={{ fontSize: "1.1rem", opacity: 0.9, marginBottom: "2rem", color: "rgba(255,255,255,0.9)" }}>
            Join hundreds of GSU students already using PantherTutor to improve
            their grades and help others succeed.
          </p>
          <Link
            href="/register"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "1rem 2.5rem",
              background: "white",
              color: "var(--gsu-blue)",
              borderRadius: "var(--radius-lg)",
              fontWeight: 700,
              fontSize: "1.1rem",
              transition: "var(--transition)",
              textDecoration: "none",
            }}
          >
            Sign Up Now →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: "2rem 1.5rem",
        textAlign: "center",
        borderTop: "1px solid var(--border-color)",
        color: "var(--text-muted)",
        fontSize: "0.85rem",
      }}>
        <p style={{ margin: 0, color: "var(--text-muted)" }}>
          © 2026 PantherTutor — Georgia State University. Built with 💙 by the
          PantherTutor Team.
        </p>
      </footer>

      <style jsx>{`
        @media (max-width: 768px) {
          section:first-of-type > div > div:last-child {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 1rem !important;
            padding: 1.5rem !important;
          }
        }
        @media (max-width: 480px) {
          section:first-of-type > div > div:last-child {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
