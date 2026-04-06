"use client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Skill {
  id: number;
  name: string;
  category: string; // derived from course code prefix
}

interface UserSkill {
  skill_id: number;
  is_strength: boolean;
}

interface ProfileData {
  full_name: string;
  bio: string;
  major: string;
  year: string;
  vacation_mode: boolean;
}

const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];
const MAX_STRENGTHS = 4;
const MAX_WEAKNESSES = 4;

// Map course code prefixes to readable category names
const PREFIX_TO_CATEGORY: Record<string, string> = {
  CSC: "Computer Science",
  MATH: "Mathematics",
  BIOL: "Biology",
  CHEM: "Chemistry",
  PHYS: "Physics",
  ACCT: "Accounting",
  ECON: "Economics",
  MGS: "Business",
  ENGL: "English",
  PHIL: "Philosophy",
  PSYC: "Psychology",
  POLS: "Political Science",
};

function getCategoryFromName(name: string): string {
  const prefix = name.split(" ")[0];
  return PREFIX_TO_CATEGORY[prefix] || prefix;
}

// Derive ordered category list from the prefix map
const CATEGORIES = [...new Set(Object.values(PREFIX_TO_CATEGORY))];

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
    vacation_mode: false,
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
        .select("full_name, bio, major, year, vacation_mode")
        .eq("id", user!.id)
        .single();
      if (prof) {
        setProfile({
          full_name: prof.full_name || user!.user_metadata?.full_name || "",
          bio: prof.bio || "",
          major: prof.major || "",
          year: prof.year || "",
          vacation_mode: prof.vacation_mode || false,
        });
      }

      // Load all skills (DB has id + name only; we derive category from prefix)
      const { data: allSkills } = await supabase
        .from("skills")
        .select("id, name")
        .order("name");
      const enriched = (allSkills || []).map((s) => ({
        ...s,
        category: getCategoryFromName(s.name),
      }));
      setSkills(enriched);

      // Load user skills (DB uses level enum: mastered = strength, needs_help = weakness)
      const { data: us } = await supabase
        .from("user_skills")
        .select("skill_id, level")
        .eq("user_id", user!.id);
      const mapped = (us || []).map((s) => ({
        skill_id: s.skill_id,
        is_strength: s.level === "mastered" || s.level === "proficient",
      }));
      setUserSkills(mapped);
      setLoadingData(false);
    }
    load();
  }, [user]);

  const toggleSkill = useCallback((skillId: number, isStrength: boolean) => {
    setUserSkills((prev) => {
      const existing = prev.find((s) => s.skill_id === skillId && s.is_strength === isStrength);
      if (existing) {
        // Always allow deselecting
        return prev.filter((s) => !(s.skill_id === skillId && s.is_strength === isStrength));
      }
      // Enforce limits before adding
      const currentCount = prev.filter((s) => s.is_strength === isStrength).length;
      const max = isStrength ? MAX_STRENGTHS : MAX_WEAKNESSES;
      if (currentCount >= max) return prev; // at limit, do nothing
      // Remove if it exists in the other category
      const filtered = prev.filter((s) => s.skill_id !== skillId);
      return [...filtered, { skill_id: skillId, is_strength: isStrength }];
    });
  }, []);

  const isSelected = (skillId: number, isStrength: boolean) => {
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

      // Save skills: delete all then insert (map is_strength back to DB level enum)
      await supabase.from("user_skills").delete().eq("user_id", user.id);
      if (userSkills.length > 0) {
        await supabase.from("user_skills").insert(
          userSkills.map((s) => ({
            user_id: user.id,
            skill_id: s.skill_id,
            level: s.is_strength ? "mastered" : "needs_help",
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
    { id: "strengths" as const, label: `Strengths (${strengths.length}/${MAX_STRENGTHS})`, icon: "💪" },
    { id: "weaknesses" as const, label: `Weaknesses (${weaknesses.length}/${MAX_WEAKNESSES})`, icon: "📚" },
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

                {/* Vacation Mode */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem",
                  borderRadius: "var(--radius-lg)",
                  border: `1px solid ${profile.vacation_mode ? "var(--gsu-red)" : "var(--border-color)"}`,
                  background: profile.vacation_mode ? "rgba(204,0,0,0.05)" : "var(--bg-secondary)",
                  transition: "all 0.2s ease",
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      🏖️ Vacation Mode
                    </div>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>
                      When on, your strengths are hidden from matching. You can still find tutors.
                    </p>
                  </div>
                  <button
                    onClick={() => setProfile((p) => ({ ...p, vacation_mode: !p.vacation_mode }))}
                    style={{
                      width: 52,
                      height: 28,
                      borderRadius: 14,
                      border: "none",
                      background: profile.vacation_mode ? "var(--gsu-red)" : "var(--border-color)",
                      cursor: "pointer",
                      position: "relative",
                      transition: "background 0.2s ease",
                      flexShrink: 0,
                    }}
                    aria-label="Toggle vacation mode"
                  >
                    <span style={{
                      position: "absolute",
                      top: 3,
                      left: profile.vacation_mode ? 27 : 3,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "white",
                      transition: "left 0.2s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {(activeTab === "strengths" || activeTab === "weaknesses") && (() => {
            const isStr = activeTab === "strengths";
            const currentCount = isStr ? strengths.length : weaknesses.length;
            const max = isStr ? MAX_STRENGTHS : MAX_WEAKNESSES;
            const atLimit = currentCount >= max;
            return (
            <div>
              <div className="card" style={{ cursor: "default", marginBottom: "1rem" }}>
                <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.9rem" }}>
                  {isStr
                    ? "💪 Select subjects you can help others with. These are your strong areas."
                    : "📚 Select subjects you'd like help with. We'll match you with tutors."}
                </p>
                {/* Limit indicator */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  marginTop: "0.75rem",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-lg)",
                  background: atLimit ? "rgba(204,0,0,0.06)" : "rgba(0,57,166,0.04)",
                  border: `1px solid ${atLimit ? "rgba(204,0,0,0.15)" : "rgba(0,57,166,0.1)"}`,
                }}>
                  <div style={{
                    display: "flex", gap: "0.25rem",
                  }}>
                    {Array.from({ length: max }).map((_, i) => (
                      <div key={i} style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: i < currentCount
                          ? (isStr ? "var(--gsu-blue)" : "var(--gsu-red)")
                          : "var(--border-color)",
                        transition: "background 0.2s ease",
                      }} />
                    ))}
                  </div>
                  <span style={{
                    fontSize: "0.8rem", fontWeight: 600,
                    color: atLimit ? "var(--gsu-red)" : "var(--text-muted)",
                  }}>
                    {currentCount}/{max} selected{atLimit ? " — limit reached" : ""}
                  </span>
                </div>
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
                        const selected = isSelected(skill.id, isStr);
                        const inOther = isSelected(skill.id, !isStr);
                        const disabled = !selected && atLimit && !inOther;
                        return (
                          <button
                            key={skill.id}
                            onClick={() => toggleSkill(skill.id, isStr)}
                            disabled={disabled}
                            style={{
                              padding: "0.5rem 1rem",
                              borderRadius: "var(--radius-full)",
                              border: selected
                                ? `2px solid ${isStr ? "var(--gsu-blue)" : "var(--gsu-red)"}`
                                : "1px solid var(--border-color)",
                              background: selected
                                ? isStr
                                  ? "rgba(0,57,166,0.12)"
                                  : "rgba(204,0,0,0.1)"
                                : inOther
                                ? "rgba(128,128,128,0.1)"
                                : disabled
                                ? "var(--bg-secondary)"
                                : "var(--bg-primary)",
                              color: selected
                                ? isStr
                                  ? "var(--gsu-blue)"
                                  : "var(--gsu-red)"
                                : inOther
                                ? "var(--text-muted)"
                                : disabled
                                ? "var(--text-muted)"
                                : "var(--text-secondary)",
                              cursor: disabled ? "not-allowed" : "pointer",
                              fontWeight: selected ? 600 : 400,
                              transition: "all 0.2s ease",
                              fontSize: "0.9rem",
                              opacity: inOther ? 0.5 : disabled ? 0.4 : 1,
                            }}
                            title={
                              inOther
                                ? `Already in ${isStr ? "weaknesses" : "strengths"}`
                                : disabled
                                ? `Max ${max} ${isStr ? "strengths" : "weaknesses"} reached`
                                : ""
                            }
                          >
                            {selected && "✓ "}
                            {skill.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            );
          })()}
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
                  💪 Strengths ({strengths.length}/{MAX_STRENGTHS})
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
                  📚 Weaknesses ({weaknesses.length}/{MAX_WEAKNESSES})
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
