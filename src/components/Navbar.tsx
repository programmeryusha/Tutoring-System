"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useTheme } from "./ThemeProvider";
import { useState, useRef, useEffect } from "react";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const isLanding = pathname === "/" && !user;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setProfileOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  const navLinks = user
    ? [
        { href: "/dashboard", label: "Dashboard", icon: "🏠" },
        { href: "/matches", label: "Matches", icon: "🤝" },
        { href: "/sessions", label: "Sessions", icon: "📅" },
        { href: "/forum", label: "Forum", icon: "💬" },
        { href: "/progress", label: "Progress", icon: "📊" },
        { href: "/about", label: "About", icon: "ℹ️" },
      ]
    : [
        { href: "/about", label: "About", icon: "ℹ️" },
      ];

  const profileLinks = [
    { href: "/me", label: "My Profile", icon: "🙋" },
    { href: "/profile", label: "Edit Profile", icon: "✏️" },
  ];

  const isOnProfilePage = pathname === "/me" || pathname === "/profile";

  // Get user initials for avatar
  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "??";

  return (
    <nav style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      background: isLanding ? "transparent" : "var(--bg-nav)",
      backdropFilter: isLanding ? "none" : "blur(20px)",
      WebkitBackdropFilter: isLanding ? "none" : "blur(20px)",
      borderBottom: isLanding ? "none" : "1px solid var(--border-color)",
      transition: "var(--transition)",
    }}>
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "0 1.5rem",
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        {/* Logo */}
        <Link href={user ? "/dashboard" : "/"} style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          textDecoration: "none",
          fontWeight: 800,
          fontSize: "1.25rem",
        }}>
          <span style={{ fontSize: "1.5rem" }}>🐾</span>
          <span className="gradient-text" style={{ letterSpacing: "-0.02em" }}>
            PantherTutor
          </span>
        </Link>

        {/* Desktop Nav */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
        }} className="desktop-nav">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.9rem",
                fontWeight: 500,
                color: pathname === link.href
                  ? "var(--gsu-blue-light)"
                  : "var(--text-secondary)",
                background: pathname === link.href
                  ? "rgba(0, 57, 166, 0.08)"
                  : "transparent",
                transition: "var(--transition)",
                textDecoration: "none",
              }}
            >
              {link.label}
            </Link>
          ))}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="btn-icon btn-ghost"
            style={{
              fontSize: "1.2rem",
              marginLeft: "0.5rem",
              background: "var(--bg-card-hover)",
              border: "1px solid var(--border-color)",
            }}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {/* User Avatar Dropdown (replaces Me, Edit Profile, Sign Out) */}
          {user ? (
            <div ref={profileRef} style={{ position: "relative", marginLeft: "0.5rem" }}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: isOnProfilePage
                    ? "var(--gsu-blue)"
                    : "linear-gradient(135deg, var(--gsu-blue), var(--gsu-blue-light))",
                  color: "#fff",
                  border: isOnProfilePage
                    ? "2px solid var(--gsu-blue-light)"
                    : "2px solid transparent",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "var(--transition)",
                  boxShadow: profileOpen ? "0 0 0 3px rgba(0,57,166,0.2)" : "none",
                }}
                aria-label="Profile menu"
              >
                {initials}
              </button>

              {/* Dropdown */}
              {profileOpen && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: 200,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-lg)",
                  padding: "0.5rem",
                  animation: "fadeIn 0.15s ease",
                  zIndex: 1001,
                }}>
                  {/* User email */}
                  <div style={{
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    borderBottom: "1px solid var(--border-color)",
                    marginBottom: "0.25rem",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {user.email}
                  </div>

                  {profileLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "var(--radius-md)",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        color: pathname === link.href
                          ? "var(--gsu-blue-light)"
                          : "var(--text-primary)",
                        background: pathname === link.href
                          ? "rgba(0, 57, 166, 0.08)"
                          : "transparent",
                        textDecoration: "none",
                        transition: "var(--transition)",
                      }}
                    >
                      <span>{link.icon}</span>
                      {link.label}
                    </Link>
                  ))}

                  <div style={{
                    height: 1,
                    background: "var(--border-color)",
                    margin: "0.25rem 0",
                  }} />

                  <button
                    onClick={() => { signOut(); setProfileOpen(false); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--radius-md)",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      color: "var(--gsu-red)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      transition: "var(--transition)",
                      textAlign: "left",
                    }}
                  >
                    <span>🚪</span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: "0.5rem" }}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="btn btn-primary btn-sm"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }} className="mobile-nav-toggle">
          <button
            onClick={toggleTheme}
            className="btn-icon btn-ghost"
            style={{
              fontSize: "1.2rem",
              background: "var(--bg-card-hover)",
              border: "1px solid var(--border-color)",
            }}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1.5rem",
              color: "var(--text-primary)",
              padding: "0.5rem",
            }}
            aria-label="Toggle mobile menu"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div style={{
          position: "absolute",
          top: 64,
          left: 0,
          right: 0,
          background: "var(--bg-primary)",
          borderBottom: "1px solid var(--border-color)",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          animation: "fadeIn 0.2s ease",
          boxShadow: "var(--shadow-lg)",
        }}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-md)",
                fontSize: "1rem",
                fontWeight: 500,
                color: pathname === link.href
                  ? "var(--gsu-blue-light)"
                  : "var(--text-primary)",
                background: pathname === link.href
                  ? "rgba(0, 57, 166, 0.08)"
                  : "transparent",
                textDecoration: "none",
              }}
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}
          <div style={{ height: 1, background: "var(--border-color)", margin: "0.5rem 0" }} />
          {user ? (
            <>
              {profileLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    fontSize: "1rem",
                    fontWeight: 500,
                    color: pathname === link.href
                      ? "var(--gsu-blue-light)"
                      : "var(--text-primary)",
                    background: pathname === link.href
                      ? "rgba(0, 57, 166, 0.08)"
                      : "transparent",
                    textDecoration: "none",
                  }}
                >
                  <span>{link.icon}</span>
                  {link.label}
                </Link>
              ))}
              <div style={{ height: 1, background: "var(--border-color)", margin: "0.5rem 0" }} />
              <button
                onClick={() => { signOut(); setMobileOpen(false); }}
                className="btn btn-ghost"
                style={{ justifyContent: "flex-start", color: "var(--gsu-red)" }}
              >
                🚪 Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)} className="btn btn-secondary" style={{ justifyContent: "center" }}>
                Sign In
              </Link>
              <Link href="/register" onClick={() => setMobileOpen(false)} className="btn btn-primary" style={{ justifyContent: "center" }}>
                Get Started
              </Link>
            </>
          )}
        </div>
      )}

      <style jsx global>{`
        .mobile-nav-toggle { display: none; }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-nav-toggle { display: flex !important; }
        }
      `}</style>
    </nav>
  );
}
