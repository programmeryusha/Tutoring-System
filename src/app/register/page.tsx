"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Create profile row so the user has a name from day one
    if (signUpData.user) {
      await supabase.from("profiles").upsert({
        id: signUpData.user.id,
        full_name: fullName,
      }, { onConflict: "id" });
    }

    router.push("/dashboard");
  }

  async function handleGoogleSignUp() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1.5rem",
    }}>
      {/* Background effects */}
      <div style={{
        position: "fixed",
        bottom: "10%",
        right: "-5%",
        width: 400,
        height: 400,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(204,0,0,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div className="fade-in" style={{
        width: "100%",
        maxWidth: 440,
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🐾</div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            Create your account
          </h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            Join the PantherTutor community today
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-xl)",
          padding: "2rem",
          boxShadow: "var(--shadow-lg)",
        }}>
          {/* Google SSO */}
          <button
            onClick={handleGoogleSignUp}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: "var(--bg-input)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              transition: "var(--transition)",
              fontFamily: "inherit",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = "var(--gsu-blue)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "var(--border-color)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            margin: "1.5rem 0",
          }}>
            <div style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
          </div>

          {/* Registration Form */}
          <form onSubmit={handleRegister}>
            <div className="input-group">
              <label className="label">Full Name</label>
              <input
                className="input"
                type="text"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="panther@student.gsu.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="label">Confirm Password</label>
              <input
                className="input"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={{
                padding: "0.75rem 1rem",
                background: "rgba(204, 0, 0, 0.08)",
                border: "1px solid rgba(204, 0, 0, 0.2)",
                borderRadius: "var(--radius-md)",
                color: "var(--gsu-red-light)",
                fontSize: "0.9rem",
                marginBottom: "1rem",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.875rem",
                fontSize: "1rem",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: "center",
          marginTop: "1.5rem",
          color: "var(--text-muted)",
          fontSize: "0.9rem",
        }}>
          Already have an account?{" "}
          <Link href="/login" style={{ fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}