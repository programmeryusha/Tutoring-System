"use client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Skill {
  id: string;
  name: string;
  category: string;
}

interface UserSkill {
  skill_id: string;
  is_strength: boolean;
  skill_level: number;
}

interface ProfileData {
  full_name: string;
  bio: string;
  major: string;
  year: string;
}

const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];
const CATEGORIES = ["Math", "Computer Science", "Science", "Humanities", "Business", "Languages"];

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: "",
    bio: "",
    major: "",
    year: "",
  });
  const [activeTab, setActiveTab] = useState<"profile" | "strengths" | "weaknesses">("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoadingData(true);
      // Load profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, bio, major, year")
        .eq("id", user!.id)
        .single();
      if (prof) {
        setProfile({
          full_name: prof.full_name || user!.user_metadata?.full_name || "",
          bio: prof.bio || "",
          major: prof.major || "",
          year: prof.year || "",
        });
      }

      // Load all skills
      const { data: allSkills } = await supabase
        .from("skills")
        .select("id, name, category")
        .order("category")
        .order("name");
      setSkills(allSkills || []);

      // Load user skills
      const { data: us } = await supabase
        .from("user_skills")
        .select("skill_id, is_strength, skill_level")
        .eq("user_id", user!.id);
      setUserSkills(us || []);
      setLoadingData(false);
    }
    load();
  }, [user]);

  const toggleSkill = useCallback((skillId: string, isStrength: boolean) => {
    setUserSkills((prev) => {
      const existing = prev.find((s) => s.skill_id === skillId && s.is_strength === isStrength);
      if (existing) {
        return prev.filter((s) => !(s.skill_id === skillId && s.is_strength === isStrength));
      }
      // Remove if it exists in the other category
      const filtered = prev.filter((s) => s.skill_id !== skillId);
      return [...filtered, { skill_id: skillId, is_strength: isStrength, skill_level: isStrength ? 3 : 1 }];
    });
  }, []);

  const isSelected = (skillId: string, isStrength: boolean) => {
    return userSkills.some((s) => s.skill_id === skillId && s.is_strength === isStrength);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Save profile
      await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          ...profile,
          updated_at: new Date().toISOString(),
        });

      // Save skills: delete all then insert
      await supabase.from("user_skills").delete().eq("user_id", user.id);
      if (userSkills.length > 0) {
        await supabase.from("user_skills").insert(
          userSkills.map((s) => ({
            user_id: user.id,
            skill_id: s.skill_id,
            is_strength: s.is_strength,
            skill_level: s.skill_level,
          }))
        );
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Save error:", err);
    }
    setSaving(false);
  };

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

  const strengths = userSkills.filter((s) => s.is_strength);
  const weaknesses = userSkills.filter((s) => !s.is_strength);

  const tabs = [
    { id: "profile" as const, label: "Profile Info", icon: "👤" },
    { id: "strengths" as const, label: `Strengths (${strengths.length})`, icon: "💪" },
    { id: "weaknesses" as const, label: `Weaknesses (${weaknesses.length})`, icon: "📚" },
  ];

  return (
    <div style={{ minHeight: "100vh", padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div className="fade-in" style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, marginBottom: "0.25rem" }}>
            Your <span className="gradient-text">Profile</span>
          </h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            Set up your skills to unlock AI-powered matching.
          </p>
        </div>

        {/* Tabs */}
        <div
          className="fade-in fade-in-delay-1"
          style={{
            display: "flex",
            gap: "0.5rem",
            marginBottom: "1.5rem",
            borderBottom: "1px solid var(--border-color)",
            paddingBottom: "0",
            overflowX: "auto",
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "0.75rem 1.25rem",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.95rem",
                color: activeTab === tab.id ? "var(--gsu-blue)" : "var(--text-muted)",
                borderBottom: activeTab === tab.id ? "3px solid var(--gsu-blue)" : "3px solid transparent",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="fade-in fade-in-delay-2">
          {activeTab === "profile" && (
            <div className="card" style={{ cursor: "default" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className="input-group">
                  <label className="label">Full Name</label>
                  <input
                    className="input"
                    type="text"
                    value={profile.full_name}
                    onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                    placeholder="Your full name"
                  />
                </div>
                <div className="input-group">
                  <label className="label">Major</label>
                  <input
                    className="input"
                    type="text"
                    value={profile.major}
                    onChange={(e) => setProfile((p) => ({ ...p, major: e.target.value }))}
                    placeholder="e.g. Computer Science"
                  />
                </div>
                <div className="input-group">
                  <label className="label">Year</label>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {YEARS.map((y) => (
                      <button
                        key={y}
                        onClick={() => setProfile((p) => ({ ...p, year: y }))}
                        style={{
                          padding: "0.5rem 1rem",
                          borderRadius: "var(--radius-full)",
                          border: profile.year === y ? "2px solid var(--gsu-blue)" : "1px solid var(--border-color)",
                          background: profile.year === y ? "rgba(0,57,166,0.1)" : "var(--bg-secondary)",
                          color: profile.year === y ? "var(--gsu-blue)" : "var(--text-secondary)",
                          cursor: "pointer",
                          fontWeight: profile.year === y ? 600 : 400,
                          transition: "all 0.2s ease",
                          fontSize: "0.9rem",
                        }}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="input-group">
                  <label className="label">Bio</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={profile.bio}
                    onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                    placeholder="Tell others about yourself..."
                    style={{ resize: "vertical" }}
                  />
                </div>
              </div>
            </div>
          )}

          {(activeTab === "strengths" || activeTab === "weaknesses") && (
            <div>
              <div className="card" style={{ cursor: "default", marginBottom: "1rem" }}>
                <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.9rem" }}>
                  {activeTab === "strengths"
                    ? "💪 Select subjects you can help others with. These are your strong areas."
                    : "📚 Select subjects you'd like help with. We'll match you with tutors."}
                </p>
              </div>

              {CATEGORIES.map((category) => {
                const categorySkills = skills.filter((s) => s.category === category);
                if (categorySkills.length === 0) return null;
                return (
                  <div key={category} style={{ marginBottom: "1.25rem" }}>
                    <h4 style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "0.5rem",
                    }}>
                      {category}
                    </h4>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {categorySkills.map((skill) => {
                        const selected = isSelected(skill.id, activeTab === "strengths");
                        const inOther = isSelected(skill.id, activeTab !== "strengths");
                        return (
                          <button
                            key={skill.id}
                            onClick={() => toggleSkill(skill.id, activeTab === "strengths")}
                            style={{
                              padding: "0.5rem 1rem",
                              borderRadius: "var(--radius-full)",
                              border: selected
                                ? `2px solid ${activeTab === "strengths" ? "var(--gsu-blue)" : "var(--gsu-red)"}`
                                : "1px solid var(--border-color)",
                              background: selected
                                ? activeTab === "strengths"
                                  ? "rgba(0,57,166,0.12)"
                                  : "rgba(204,0,0,0.1)"
                                : inOther
                                ? "rgba(128,128,128,0.1)"
                                : "var(--bg-primary)",
                              color: selected
                                ? activeTab === "strengths"
                                  ? "var(--gsu-blue)"
                                  : "var(--gsu-red)"
                                : inOther
                                ? "var(--text-muted)"
                                : "var(--text-secondary)",
                              cursor: "pointer",
                              fontWeight: selected ? 600 : 400,
                              transition: "all 0.2s ease",
                              fontSize: "0.9rem",
                              opacity: inOther ? 0.5 : 1,
                            }}
                            title={inOther ? `Already in ${activeTab === "strengths" ? "weaknesses" : "strengths"}` : ""}
                          >
                            {selected && (activeTab === "strengths" ? "✓ " : "✓ ")}
                            {skill.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div
          className="fade-in fade-in-delay-3"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "1rem",
            marginTop: "2rem",
            alignItems: "center",
          }}
        >
          {saved && (
            <span style={{ color: "#16a34a", fontWeight: 600, fontSize: "0.9rem" }}>
              ✓ Profile saved!
            </span>
          )}
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>

        {/* Summary */}
        {(strengths.length > 0 || weaknesses.length > 0) && (
          <div className="fade-in fade-in-delay-4 card" style={{ marginTop: "2rem", cursor: "default" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>Your Skill Summary</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div>
                <h4 style={{ fontSize: "0.85rem", color: "var(--gsu-blue)", fontWeight: 600, marginBottom: "0.5rem" }}>
                  💪 Strengths ({strengths.length})
                </h4>
                <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                  {strengths.map((s) => {
                    const sk = skills.find((sk) => sk.id === s.skill_id);
                    return sk ? (
                      <span key={s.skill_id} className="badge badge-blue">{sk.name}</span>
                    ) : null;
                  })}
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: "0.85rem", color: "var(--gsu-red)", fontWeight: 600, marginBottom: "0.5rem" }}>
                  📚 Weaknesses ({weaknesses.length})
                </h4>
                <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                  {weaknesses.map((s) => {
                    const sk = skills.find((sk) => sk.id === s.skill_id);
                    return sk ? (
                      <span key={s.skill_id} className="badge badge-red">{sk.name}</span>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
