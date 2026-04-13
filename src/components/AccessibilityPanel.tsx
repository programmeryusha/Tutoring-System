"use client";
import { useState, useEffect, useCallback, useRef } from "react";

/* ═══ Types ═══ */
type FontSize = "small" | "medium" | "large" | "xl";
type CursorStyle = "default" | "large" | "paw";

interface A11ySettings {
  fontSize: FontSize;
  highContrast: boolean;
  reducedMotion: boolean;
  dyslexiaFont: boolean;
  cursor: CursorStyle;
  readingGuide: boolean;
}

const DEFAULT_SETTINGS: A11ySettings = {
  fontSize: "medium",
  highContrast: false,
  reducedMotion: false,
  dyslexiaFont: false,
  cursor: "default",
  readingGuide: false,
};

const LS_KEY = "panthertutor-a11y";

function loadSettings(): A11ySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(s: A11ySettings) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {}
}

function applyToDOM(s: A11ySettings) {
  const html = document.documentElement;
  html.setAttribute("data-font-size", s.fontSize);
  html.setAttribute("data-high-contrast", String(s.highContrast));
  html.setAttribute("data-reduced-motion", String(s.reducedMotion));
  html.setAttribute("data-dyslexia-font", String(s.dyslexiaFont));
  html.setAttribute("data-cursor", s.cursor);
}

/* ═══ Component ═══ */
export default function AccessibilityPanel() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<A11ySettings>(DEFAULT_SETTINGS);
  const [mouseY, setMouseY] = useState(-100);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load on mount
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    applyToDOM(s);
  }, []);

  // Apply whenever settings change
  const update = useCallback((partial: Partial<A11ySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      applyToDOM(next);
      return next;
    });
  }, []);

  // Reading guide mouse tracker
  useEffect(() => {
    if (!settings.readingGuide) return;
    const handler = (e: MouseEvent) => setMouseY(e.clientY - 20);
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [settings.readingGuide]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const fontSizes: { value: FontSize; label: string }[] = [
    { value: "small", label: "S" },
    { value: "medium", label: "M" },
    { value: "large", label: "L" },
    { value: "xl", label: "XL" },
  ];

  const cursors: { value: CursorStyle; label: string; icon: string }[] = [
    { value: "default", label: "Default", icon: "🖱️" },
    { value: "large", label: "Large", icon: "👆" },
    { value: "paw", label: "Paw", icon: "🐾" },
  ];

  const hasChanges =
    settings.fontSize !== "medium" ||
    settings.highContrast ||
    settings.reducedMotion ||
    settings.dyslexiaFont ||
    settings.cursor !== "default" ||
    settings.readingGuide;

  return (
    <>
      {/* Reading Guide Line */}
      {settings.readingGuide && (
        <div className="reading-guide" style={{ top: mouseY }} />
      )}

      {/* Floating Panel */}
      <div ref={panelRef} style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999 }}>
        {/* Toggle Button */}
        <button
          onClick={() => setOpen(!open)}
          aria-label="Accessibility settings"
          aria-expanded={open}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: open ? "var(--gsu-blue)" : "var(--bg-card)",
            color: open ? "white" : "var(--text-primary)",
            border: `2px solid ${open ? "var(--gsu-blue)" : "var(--border-color)"}`,
            boxShadow: "var(--shadow-lg)",
            fontSize: "1.3rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s ease",
            position: "relative",
          }}
        >
          ♿
          {hasChanges && (
            <div
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "var(--gsu-red)",
                border: "2px solid var(--bg-primary)",
              }}
            />
          )}
        </button>

        {/* Panel */}
        {open && (
          <div
            style={{
              position: "absolute",
              bottom: 60,
              right: 0,
              width: 300,
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-xl)",
              padding: "1.25rem",
              animation: "fadeSlideUp 0.2s ease",
            }}
            role="dialog"
            aria-label="Accessibility settings panel"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1rem",
              }}
            >
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                ♿ Accessibility
              </h3>
              {hasChanges && (
                <button
                  onClick={() => update(DEFAULT_SETTINGS)}
                  style={{
                    fontSize: "0.75rem",
                    padding: "3px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-color)",
                    background: "transparent",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontWeight: 600,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--gsu-red)";
                    e.currentTarget.style.color = "var(--gsu-red)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-color)";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  Reset All
                </button>
              )}
            </div>

            {/* Font Size */}
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: "0.4rem",
                }}
              >
                📝 Font Size
              </label>
              <div
                style={{
                  display: "flex",
                  gap: "0.25rem",
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.2rem",
                }}
              >
                {fontSizes.map((fs) => (
                  <button
                    key={fs.value}
                    onClick={() => update({ fontSize: fs.value })}
                    style={{
                      flex: 1,
                      padding: "0.35rem 0",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      background:
                        settings.fontSize === fs.value
                          ? "var(--gsu-blue)"
                          : "transparent",
                      color:
                        settings.fontSize === fs.value
                          ? "#fff"
                          : "var(--text-muted)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {fs.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cursor Style */}
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: "0.4rem",
                }}
              >
                🖱️ Cursor Style
              </label>
              <div
                style={{
                  display: "flex",
                  gap: "0.25rem",
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.2rem",
                }}
              >
                {cursors.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => update({ cursor: c.value })}
                    style={{
                      flex: 1,
                      padding: "0.35rem 0",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      background:
                        settings.cursor === c.value
                          ? "var(--gsu-blue)"
                          : "transparent",
                      color:
                        settings.cursor === c.value
                          ? "#fff"
                          : "var(--text-muted)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle switches */}
            {[
              {
                key: "highContrast" as const,
                label: "High Contrast",
                icon: "🔲",
                desc: "Stronger color contrast",
                value: settings.highContrast,
              },
              {
                key: "reducedMotion" as const,
                label: "Reduced Motion",
                icon: "🚫",
                desc: "Disable animations",
                value: settings.reducedMotion,
              },
              {
                key: "dyslexiaFont" as const,
                label: "Dyslexia Font",
                icon: "🔤",
                desc: "Wider spacing, friendlier font",
                value: settings.dyslexiaFont,
              },
              {
                key: "readingGuide" as const,
                label: "Reading Guide",
                icon: "📏",
                desc: "Line highlight follows mouse",
                value: settings.readingGuide,
              },
            ].map((toggle) => (
              <div
                key={toggle.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.5rem 0",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1rem" }}>{toggle.icon}</span>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      {toggle.label}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {toggle.desc}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => update({ [toggle.key]: !toggle.value })}
                  role="switch"
                  aria-checked={toggle.value}
                  aria-label={toggle.label}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    border: "none",
                    padding: 2,
                    cursor: "pointer",
                    background: toggle.value
                      ? "var(--gsu-blue)"
                      : "var(--bg-secondary)",
                    transition: "background 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "white",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      transition: "transform 0.2s ease",
                      transform: toggle.value
                        ? "translateX(20px)"
                        : "translateX(0)",
                    }}
                  />
                </button>
              </div>
            ))}

            <div
              style={{
                marginTop: "0.75rem",
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                textAlign: "center",
              }}
            >
              Settings are saved automatically
            </div>
          </div>
        )}
      </div>

      {/* fadeSlideUp animation */}
      <style jsx>{`
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
