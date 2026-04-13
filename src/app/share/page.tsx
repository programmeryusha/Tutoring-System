"use client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { BADGES } from "@/lib/badges";

/* ═══════════════════════════════════════════════════════════
   /share – Generate & share a PantherTutor achievement card
   ═══════════════════════════════════════════════════════════ */

interface ShareData {
  profile: { full_name: string | null; major: string | null; year: string | null; role: string };
  stats: {
    totalSessions: number;
    tutorSessions: number;
    studentSessions: number;
    totalHours: number;
    avgRating: number | null;
    tutorAvgRating: number | null;
    reviewCount: number;
    connectionCount: number;
  };
  strengths: string[];
  earnedBadgeIds: string[];
}

type CardStyle = "achievement" | "tutor" | "milestone";

/* ── Draw helpers ── */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

/* ═══ Card renderer ═══ */
function drawCard(
  canvas: HTMLCanvasElement,
  data: ShareData,
  style: CardStyle
) {
  const W = 1200;
  const H = 630;
  const dpr = 2;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  /* ── Background ── */
  const gsuBlue = "#0039A6";
  const gsuRed = "#CC0000";
  const darkBg = "#0f172a";

  if (style === "tutor") {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#001f5c");
    grad.addColorStop(0.5, gsuBlue);
    grad.addColorStop(1, "#0050d4");
    ctx.fillStyle = grad;
  } else if (style === "milestone") {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#1a0a00");
    grad.addColorStop(0.3, "#4a1500");
    grad.addColorStop(0.7, gsuRed);
    grad.addColorStop(1, "#ff3333");
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, darkBg);
    grad.addColorStop(0.6, "#1e293b");
    grad.addColorStop(1, "#0f172a");
    ctx.fillStyle = grad;
  }
  roundRect(ctx, 0, 0, W, H, 24);
  ctx.fill();

  /* ── Subtle pattern overlay ── */
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 120 + 40, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* ── Top accent bar ── */
  const grad2 = ctx.createLinearGradient(0, 0, W, 0);
  grad2.addColorStop(0, gsuBlue);
  grad2.addColorStop(1, gsuRed);
  ctx.fillStyle = grad2;
  ctx.fillRect(0, 0, W, 6);

  /* ── Logo / branding area ── */
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.fillText("🐾 PantherTutor", 48, 56);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "14px system-ui, -apple-system, sans-serif";
  ctx.fillText("Georgia State University • Peer Tutoring Platform", 48, 80);

  /* ── GSU seal (right side) ── */
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.arc(W - 100, 60, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "bold 18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("GSU", W - 100, 66);
  ctx.textAlign = "left";

  const name = data.profile.full_name || "PantherTutor User";
  const major = data.profile.major || "";
  const year = data.profile.year || "";

  /* ── User section ── */
  // Avatar circle
  const avatarX = 80;
  const avatarY = 155;
  const avatarR = 42;
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR + 4, 0, Math.PI * 2);
  ctx.fill();

  const avatarGrad = ctx.createLinearGradient(
    avatarX - avatarR, avatarY - avatarR,
    avatarX + avatarR, avatarY + avatarR
  );
  avatarGrad.addColorStop(0, gsuBlue);
  avatarGrad.addColorStop(1, style === "milestone" ? gsuRed : "#0050d4");
  ctx.fillStyle = avatarGrad;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
  ctx.fill();

  // Initials
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 30px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(initials, avatarX, avatarY + 11);
  ctx.textAlign = "left";

  // Name + info
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
  ctx.fillText(truncText(ctx, name, 600), 140, 148);

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "16px system-ui, -apple-system, sans-serif";
  const subtitle = [major, year].filter(Boolean).join(" • ");
  if (subtitle) ctx.fillText(subtitle, 140, 176);

  /* ── Stats grid ── */
  const statsY = 220;
  const statBoxW = 160;
  const statBoxH = 90;
  const statGap = 16;
  const statsX = 48;

  const statItems = [
    { value: String(data.stats.totalSessions), label: "Sessions", icon: "📚" },
    { value: `${data.stats.totalHours}h`, label: "Hours", icon: "⏱️" },
    {
      value: data.stats.avgRating ? `${data.stats.avgRating} ⭐` : "N/A",
      label: "Rating",
      icon: "",
    },
    { value: String(data.stats.connectionCount), label: "Connections", icon: "🤝" },
  ];

  statItems.forEach((stat, i) => {
    const sx = statsX + i * (statBoxW + statGap);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, sx, statsY, statBoxW, statBoxH, 12);
    ctx.fill();

    // add subtle border
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    roundRect(ctx, sx, statsY, statBoxW, statBoxH, 12);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(stat.icon ? `${stat.icon} ${stat.value}` : stat.value, sx + statBoxW / 2, statsY + 40);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "13px system-ui, -apple-system, sans-serif";
    ctx.fillText(stat.label, sx + statBoxW / 2, statsY + 65);
    ctx.textAlign = "left";
  });

  /* ── Badges row ── */
  const earnedBadges = BADGES.filter((b) => data.earnedBadgeIds.includes(b.id));
  if (earnedBadges.length > 0) {
    const badgesY = statsY + statBoxH + 30;

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
    ctx.fillText("BADGES EARNED", statsX, badgesY);

    const maxBadges = Math.min(earnedBadges.length, 8);
    const badgeSize = 48;
    const badgeGap = 12;

    for (let i = 0; i < maxBadges; i++) {
      const bx = statsX + i * (badgeSize + badgeGap);
      const by = badgesY + 12;

      ctx.fillStyle = "rgba(255,255,255,0.08)";
      roundRect(ctx, bx, by, badgeSize, badgeSize, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      roundRect(ctx, bx, by, badgeSize, badgeSize, 10);
      ctx.stroke();

      ctx.font = "24px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(earnedBadges[i].icon, bx + badgeSize / 2, by + badgeSize / 2 + 8);
      ctx.textAlign = "left";
    }
    if (earnedBadges.length > 8) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "14px system-ui";
      ctx.fillText(
        `+${earnedBadges.length - 8} more`,
        statsX + 8 * (badgeSize + badgeGap) + 8,
        badgesY + 12 + badgeSize / 2 + 5
      );
    }
  }

  /* ── Skills column (right side) ── */
  if (data.strengths.length > 0) {
    const skillsX = W - 380;
    const skillsY = statsY;

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
    ctx.fillText("SKILLS & EXPERTISE", skillsX, skillsY);

    ctx.font = "15px system-ui, -apple-system, sans-serif";
    data.strengths.slice(0, 6).forEach((skill, i) => {
      const sy = skillsY + 22 + i * 32;
      const pillW = Math.min(ctx.measureText(skill).width + 28, 320);

      ctx.fillStyle = "rgba(255,255,255,0.08)";
      roundRect(ctx, skillsX, sy, pillW, 26, 13);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(skill, skillsX + 14, sy + 18);
    });
  }

  /* ── Footer ── */
  const footY = H - 48;

  // Bottom accent
  const grad3 = ctx.createLinearGradient(0, 0, W, 0);
  grad3.addColorStop(0, gsuBlue);
  grad3.addColorStop(1, gsuRed);
  ctx.fillStyle = grad3;
  ctx.fillRect(0, H - 4, W, 4);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "13px system-ui, -apple-system, sans-serif";
  ctx.fillText("panthertutor.vercel.app", 48, footY);

  // Timestamp
  ctx.textAlign = "right";
  ctx.fillText(new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }), W - 48, footY);
  ctx.textAlign = "left";

  /* ── Role badge ── */
  const roleBadge =
    data.stats.tutorSessions > 0 && data.stats.studentSessions > 0
      ? "Tutor & Student"
      : data.stats.tutorSessions > 0
      ? "Peer Tutor"
      : "Student";

  const roleX = W - 380;
  const roleY = 140;
  const roleText = `🎓 ${roleBadge}`;
  ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
  const roleW = ctx.measureText(roleText).width + 24;

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  roundRect(ctx, roleX, roleY - 16, roleW, 28, 14);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText(roleText, roleX + 12, roleY + 4);
}

/* ══════════════════════════════════════
   Page Component
   ══════════════════════════════════════ */
export default function SharePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<ShareData | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [cardStyle, setCardStyle] = useState<CardStyle>("achievement");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  /* ── Scroll reveal ── */
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observe = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("animate-visible");
              observerRef.current?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
      );
    }
    observerRef.current.observe(el);
  }, []);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  /* ── Fetch data ── */
  useEffect(() => {
    if (!user) return;
    fetch(`/api/share?user_id=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setFetchError(d.error);
        else setData(d);
      })
      .catch((e) => setFetchError(e.message));
  }, [user]);

  /* ── Draw card when data or style changes ── */
  useEffect(() => {
    if (!data || !canvasRef.current) return;
    drawCard(canvasRef.current, data, cardStyle);
  }, [data, cardStyle]);

  /* ── Download as PNG ── */
  const handleDownload = () => {
    if (!canvasRef.current) return;
    setDownloading(true);
    const link = document.createElement("a");
    link.download = `panthertutor-${cardStyle}-card.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
    setTimeout(() => setDownloading(false), 1000);
  };

  /* ── Share URLs ── */
  const shareText = data
    ? `Check out my PantherTutor achievement card! 🐾 ${data.stats.totalSessions} sessions completed, ${data.stats.totalHours}h logged${data.stats.avgRating ? `, ${data.stats.avgRating}⭐ rating` : ""}. #PantherTutor #GSU #PeerTutoring`
    : "";
  const siteUrl = "https://panthertutor.vercel.app";
  const profileUrl = user ? `${siteUrl}/profile/${user.id}` : siteUrl;

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`;

  /* ── Copy link ── */
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback */
      const ta = document.createElement("textarea");
      ta.value = profileUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>
        <div className="panther-loader" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingTop: 80 }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px 60px" }}>
        {/* Header */}
        <div ref={observe} className="animate-on-scroll" style={{ marginBottom: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
            🐾 Share Your Achievements
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 16, maxWidth: 500, margin: "0 auto" }}>
            Generate a beautiful card to showcase your PantherTutor journey on social media
          </p>
        </div>

        {fetchError && (
          <div style={{ background: "#CC000022", border: "1px solid #CC0000", borderRadius: 12, padding: 16, marginBottom: 24, color: "var(--gsu-red-light)", textAlign: "center" }}>
            {fetchError}
          </div>
        )}

        {/* Style picker */}
        <div ref={observe} className="animate-on-scroll" style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 32, flexWrap: "wrap" }}>
          {(
            [
              { id: "achievement" as CardStyle, label: "🏆 Achievement", desc: "Dark elegant" },
              { id: "tutor" as CardStyle, label: "📘 Panther Blue", desc: "GSU blue theme" },
              { id: "milestone" as CardStyle, label: "🔥 Milestone", desc: "Red gradient" },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              onClick={() => setCardStyle(s.id)}
              style={{
                padding: "12px 24px",
                borderRadius: 12,
                border: `2px solid ${cardStyle === s.id ? "var(--accent-link)" : "var(--border-color)"}`,
                background: cardStyle === s.id ? "var(--accent-link)" : "var(--bg-card)",
                color: cardStyle === s.id ? "#fff" : "var(--text-primary)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                transition: "all 0.2s",
              }}
            >
              <div>{s.label}</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{s.desc}</div>
            </button>
          ))}
        </div>

        {/* Canvas preview */}
        <div
          ref={observe}
          className="animate-on-scroll"
          style={{
            background: "var(--bg-card)",
            borderRadius: 16,
            border: "1px solid var(--border-color)",
            padding: 24,
            marginBottom: 32,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div style={{ overflow: "auto", display: "flex", justifyContent: "center" }}>
            <canvas
              ref={canvasRef}
              style={{
                borderRadius: 12,
                maxWidth: "100%",
                height: "auto",
              }}
            />
          </div>
          {!data && !fetchError && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
              Loading your stats...
            </div>
          )}
        </div>

        {/* Action buttons */}
        {data && (
          <div
            ref={observe}
            className="animate-on-scroll"
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
              marginBottom: 40,
            }}
          >
            {/* Download */}
            <button
              onClick={handleDownload}
              style={{
                padding: "14px 28px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #0039A6, #002266)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.2s",
                opacity: downloading ? 0.7 : 1,
              }}
            >
              {downloading ? "✓ Saved!" : "⬇️ Download PNG"}
            </button>

            {/* Twitter */}
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "14px 28px",
                borderRadius: 12,
                border: "none",
                background: "#1DA1F2",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                gap: 8,
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              𝕏 Share on Twitter
            </a>

            {/* LinkedIn */}
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "14px 28px",
                borderRadius: 12,
                border: "none",
                background: "#0A66C2",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                gap: 8,
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              💼 Share on LinkedIn
            </a>

            {/* Copy link */}
            <button
              onClick={copyLink}
              style={{
                padding: "14px 28px",
                borderRadius: 12,
                border: "1px solid var(--border-color)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
            >
              {copied ? "✓ Copied!" : "🔗 Copy Profile Link"}
            </button>
          </div>
        )}

        {/* How to share guide */}
        <div
          ref={observe}
          className="animate-on-scroll"
          style={{
            background: "var(--bg-card)",
            borderRadius: 16,
            border: "1px solid var(--border-color)",
            padding: 32,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>
            📋 How to Share
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            {[
              {
                step: "1",
                title: "Choose a Style",
                desc: "Pick a card theme that matches your vibe — dark, blue, or red gradient.",
              },
              {
                step: "2",
                title: "Download Your Card",
                desc: "Click \"Download PNG\" to save a high-res image to your device.",
              },
              {
                step: "3",
                title: "Post It!",
                desc: "Share the image on Twitter, LinkedIn, or any platform. Use #PantherTutor!",
              },
            ].map((item) => (
              <div
                key={item.step}
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0039A6, #002266)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {item.step}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div
          ref={observe}
          className="animate-on-scroll"
          style={{
            marginTop: 24,
            background: "rgba(0,57,166,0.08)",
            borderRadius: 12,
            padding: "16px 20px",
            border: "1px solid rgba(0,57,166,0.15)",
          }}
        >
          <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            <strong style={{ color: "var(--accent-link)" }}>💡 Pro tip:</strong>{" "}
            Complete more sessions, earn badges, and build connections to make your card even more impressive.
            Your card updates in real-time with your latest stats!
          </p>
        </div>
      </div>
    </div>
  );
}
