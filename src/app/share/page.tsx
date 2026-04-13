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

  const gsuBlue = "#0039A6";
  const gsuRed = "#CC0000";

  /* ── Background ── */
  if (style === "tutor") {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#001a4d");
    grad.addColorStop(0.5, "#002e8a");
    grad.addColorStop(1, "#0050d4");
    ctx.fillStyle = grad;
  } else if (style === "milestone") {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#1a0a00");
    grad.addColorStop(0.4, "#5a1a00");
    grad.addColorStop(1, "#cc2200");
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(0.5, "#1e293b");
    grad.addColorStop(1, "#0f172a");
    ctx.fillStyle = grad;
  }
  roundRect(ctx, 0, 0, W, H, 24);
  ctx.fill();

  /* ── Subtle decorative circles ── */
  ctx.globalAlpha = 0.025;
  const seed = data.profile.full_name?.length || 7;
  for (let i = 0; i < 12; i++) {
    const cx = ((seed * (i + 1) * 97) % W);
    const cy = ((seed * (i + 1) * 53) % H);
    ctx.beginPath();
    ctx.arc(cx, cy, 60 + (i * 15), 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* ── Top accent bar ── */
  const topBarGrad = ctx.createLinearGradient(0, 0, W, 0);
  topBarGrad.addColorStop(0, gsuBlue);
  topBarGrad.addColorStop(1, gsuRed);
  ctx.fillStyle = topBarGrad;
  ctx.fillRect(0, 0, W, 6);

  /* ── Bottom accent bar ── */
  const botBarGrad = ctx.createLinearGradient(0, 0, W, 0);
  botBarGrad.addColorStop(0, gsuBlue);
  botBarGrad.addColorStop(1, gsuRed);
  ctx.fillStyle = botBarGrad;
  ctx.fillRect(0, H - 5, W, 5);

  // ─── LAYOUT CONSTANTS ───
  const padX = 60;
  const contentW = W - padX * 2;

  /* ═══ Header row: Logo left, GSU badge right ═══ */
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px system-ui, -apple-system, sans-serif";
  ctx.fillText("🐾 PantherTutor", padX, 54);

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "15px system-ui, -apple-system, sans-serif";
  ctx.fillText("Georgia State University  •  Peer Tutoring Platform", padX, 80);

  // GSU circle badge (top-right)
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.arc(W - padX - 35, 52, 35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = "bold 16px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("GSU", W - padX - 35, 58);
  ctx.textAlign = "left";

  /* ── Divider ── */
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, 100);
  ctx.lineTo(W - padX, 100);
  ctx.stroke();

  /* ═══ User identity section ═══ */
  const name = data.profile.full_name || "PantherTutor User";
  const major = data.profile.major || "";
  const year = data.profile.year || "";
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  // Avatar
  const avatarX = padX + 48;
  const avatarY = 165;
  const avatarR = 48;

  // Glow ring
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR + 6, 0, Math.PI * 2);
  ctx.fill();

  // Avatar gradient
  const avatarGrad = ctx.createLinearGradient(
    avatarX - avatarR, avatarY - avatarR,
    avatarX + avatarR, avatarY + avatarR
  );
  avatarGrad.addColorStop(0, gsuBlue);
  avatarGrad.addColorStop(1, style === "milestone" ? gsuRed : "#0060e0");
  ctx.fillStyle = avatarGrad;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
  ctx.fill();

  // Initials
  ctx.fillStyle = "#fff";
  ctx.font = "bold 34px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(initials, avatarX, avatarY + 12);
  ctx.textAlign = "left";

  // Name
  const nameX = avatarX + avatarR + 28;
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 38px system-ui, -apple-system, sans-serif";
  ctx.fillText(truncText(ctx, name, 550), nameX, avatarY - 6);

  // Subtitle: major • year
  const subtitle = [major, year].filter(Boolean).join("  •  ");
  if (subtitle) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "18px system-ui, -apple-system, sans-serif";
    ctx.fillText(subtitle, nameX, avatarY + 22);
  }

  // Role badge (right-aligned with the name row)
  const roleBadge =
    data.stats.tutorSessions > 0 && data.stats.studentSessions > 0
      ? "Tutor & Student"
      : data.stats.tutorSessions > 0
      ? "Peer Tutor"
      : "Student";
  const roleText = `🎓  ${roleBadge}`;
  ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
  const roleW = ctx.measureText(roleText).width + 32;
  const roleX = W - padX - roleW;
  const roleY = avatarY - 16;

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, roleX, roleY, roleW, 34, 17);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  roundRect(ctx, roleX, roleY, roleW, 34, 17);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(roleText, roleX + 16, roleY + 23);

  /* ═══ Stats row — centered, spacious ═══ */
  const statsY = 240;
  const statCount = 4;
  const statBoxW = 220;
  const statBoxH = 110;
  const totalStatsW = statCount * statBoxW + (statCount - 1) * 24;
  const statsX = (W - totalStatsW) / 2;
  const statGap = 24;

  const statItems = [
    { value: String(data.stats.totalSessions), label: "Sessions Completed", icon: "📚" },
    { value: `${data.stats.totalHours}h`, label: "Hours Logged", icon: "⏱️" },
    {
      value: data.stats.avgRating ? `${data.stats.avgRating}` : "—",
      label: data.stats.avgRating ? `Rating  (${data.stats.reviewCount} reviews)` : "No Ratings Yet",
      icon: data.stats.avgRating ? "⭐" : "⭐",
    },
    { value: String(data.stats.connectionCount), label: "Connections", icon: "🤝" },
  ];

  statItems.forEach((stat, i) => {
    const sx = statsX + i * (statBoxW + statGap);

    // Card background
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRect(ctx, sx, statsY, statBoxW, statBoxH, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    roundRect(ctx, sx, statsY, statBoxW, statBoxH, 16);
    ctx.stroke();

    // Icon + value
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px system-ui, -apple-system, sans-serif";
    const display = stat.icon ? `${stat.icon}  ${stat.value}` : stat.value;
    ctx.fillText(display, sx + statBoxW / 2, statsY + 48);

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "14px system-ui, -apple-system, sans-serif";
    ctx.fillText(stat.label, sx + statBoxW / 2, statsY + 78);
    ctx.textAlign = "left";
  });

  /* ═══ Bottom section: Badges (left) + Skills (right) ═══ */
  const bottomY = statsY + statBoxH + 40;
  const earnedBadges = BADGES.filter((b) => data.earnedBadgeIds.includes(b.id));
  const hasSkills = data.strengths.length > 0;
  const hasBadges = earnedBadges.length > 0;

  // Section label style
  const drawSectionLabel = (text: string, x: number, y: number) => {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
    ctx.letterSpacing = "1px";
    ctx.fillText(text, x, y);
    ctx.letterSpacing = "0px";
  };

  if (hasBadges) {
    drawSectionLabel("BADGES EARNED", padX, bottomY);

    const maxBadges = Math.min(earnedBadges.length, 10);
    const badgeSize = 56;
    const badgeGap = 14;

    for (let i = 0; i < maxBadges; i++) {
      const bx = padX + i * (badgeSize + badgeGap);
      const by = bottomY + 14;

      ctx.fillStyle = "rgba(255,255,255,0.06)";
      roundRect(ctx, bx, by, badgeSize, badgeSize, 14);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      roundRect(ctx, bx, by, badgeSize, badgeSize, 14);
      ctx.stroke();

      ctx.font = "28px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(earnedBadges[i].icon, bx + badgeSize / 2, by + badgeSize / 2 + 10);
      ctx.textAlign = "left";
    }

    // Badge name below each icon
    ctx.font = "10px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.textAlign = "center";
    for (let i = 0; i < Math.min(maxBadges, 6); i++) {
      const bx = padX + i * (badgeSize + badgeGap);
      ctx.fillText(
        truncText(ctx, earnedBadges[i].name, badgeSize + 4),
        bx + badgeSize / 2,
        bottomY + 14 + badgeSize + 14
      );
    }
    ctx.textAlign = "left";

    if (earnedBadges.length > maxBadges) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "bold 15px system-ui";
      ctx.fillText(
        `+${earnedBadges.length - maxBadges} more`,
        padX + maxBadges * (badgeSize + badgeGap) + 8,
        bottomY + 14 + badgeSize / 2 + 6
      );
    }
  }

  if (hasSkills) {
    const skillsX = hasBadges ? W - 400 : padX;
    drawSectionLabel("SKILLS & EXPERTISE", skillsX, bottomY);

    ctx.font = "16px system-ui, -apple-system, sans-serif";
    data.strengths.slice(0, 4).forEach((skill, i) => {
      const sy = bottomY + 16 + i * 38;
      const pillW = Math.min(ctx.measureText(skill).width + 36, 340);

      ctx.fillStyle = "rgba(255,255,255,0.06)";
      roundRect(ctx, skillsX, sy, pillW, 30, 15);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      roundRect(ctx, skillsX, sy, pillW, 30, 15);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(skill, skillsX + 18, sy + 21);
    });
  }

  /* ═══ Footer ═══ */
  const footY = H - 32;
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "14px system-ui, -apple-system, sans-serif";
  ctx.fillText("panthertutor.vercel.app", padX, footY);

  ctx.textAlign = "right";
  ctx.fillText(new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }), W - padX, footY);
  ctx.textAlign = "left";
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
