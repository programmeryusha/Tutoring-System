/* ═══ Badge Definitions ═══
   Each badge has an id, display info, and a check function
   that receives the user's aggregated stats and returns true
   if the badge should be awarded. */

export interface UserStats {
  totalSessions: number;       // completed sessions (as tutor or student)
  tutorSessions: number;       // completed sessions as tutor (user1_id)
  studentSessions: number;     // completed sessions as student (user2_id)
  totalHours: number;          // sum of duration_minutes / 60
  avgRating: number | null;    // avg rating received (all roles)
  reviewCount: number;         // total reviews received
  tutorAvgRating: number | null;
  tutorReviewCount: number;
  uniqueStudents: number;      // distinct students tutored
  uniqueTutors: number;        // distinct tutors learned from
  uniqueSubjects: number;      // distinct skill_ids in completed sessions
  connectionCount: number;     // accepted matches
  streakWeeks: number;         // consecutive weeks with >= 1 session
  strengthCount: number;       // number of skills marked as strength
}

export interface BadgeDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "sessions" | "ratings" | "social" | "mastery" | "dedication";
  check: (stats: UserStats) => boolean;
}

export const BADGES: BadgeDef[] = [
  /* ── Sessions ── */
  {
    id: "first_steps",
    name: "First Steps",
    icon: "🎯",
    description: "Complete your first session",
    category: "sessions",
    check: (s) => s.totalSessions >= 1,
  },
  {
    id: "getting_started",
    name: "Getting Started",
    icon: "📖",
    description: "Complete 5 sessions",
    category: "sessions",
    check: (s) => s.totalSessions >= 5,
  },
  {
    id: "dedicated_learner",
    name: "Dedicated Learner",
    icon: "📚",
    description: "Complete 10 sessions",
    category: "sessions",
    check: (s) => s.totalSessions >= 10,
  },
  {
    id: "veteran_tutor",
    name: "Veteran Tutor",
    icon: "🏆",
    description: "Complete 25 sessions as a tutor",
    category: "sessions",
    check: (s) => s.tutorSessions >= 25,
  },
  {
    id: "century_club",
    name: "Century Club",
    icon: "💯",
    description: "Complete 100 sessions total",
    category: "sessions",
    check: (s) => s.totalSessions >= 100,
  },

  /* ── Ratings ── */
  {
    id: "five_star",
    name: "Five Star",
    icon: "⭐",
    description: "Maintain a perfect 5.0 rating (min 5 reviews)",
    category: "ratings",
    check: (s) => s.reviewCount >= 5 && s.avgRating !== null && s.avgRating >= 5.0,
  },
  {
    id: "highly_rated",
    name: "Highly Rated",
    icon: "🌟",
    description: "4.5+ avg rating with 10+ reviews",
    category: "ratings",
    check: (s) => s.reviewCount >= 10 && s.avgRating !== null && s.avgRating >= 4.5,
  },
  {
    id: "top_tutor",
    name: "Top Tutor",
    icon: "👑",
    description: "4.8+ tutor rating with 15+ tutor reviews",
    category: "ratings",
    check: (s) =>
      s.tutorReviewCount >= 15 && s.tutorAvgRating !== null && s.tutorAvgRating >= 4.8,
  },

  /* ── Social ── */
  {
    id: "helping_hand",
    name: "Helping Hand",
    icon: "🤝",
    description: "Tutor 5 different students",
    category: "social",
    check: (s) => s.uniqueStudents >= 5,
  },
  {
    id: "networker",
    name: "Networker",
    icon: "🌐",
    description: "Have 10+ accepted connections",
    category: "social",
    check: (s) => s.connectionCount >= 10,
  },
  {
    id: "community_pillar",
    name: "Community Pillar",
    icon: "🏛️",
    description: "Tutor 15 different students",
    category: "social",
    check: (s) => s.uniqueStudents >= 15,
  },

  /* ── Mastery ── */
  {
    id: "subject_expert",
    name: "Subject Expert",
    icon: "🧠",
    description: "15+ sessions in a single subject",
    category: "mastery",
    // This requires special handling — we check uniqueSubjects as a proxy
    // but the real check happens in the API with per-subject counts
    check: () => false, // handled in API
  },
  {
    id: "polymath",
    name: "Polymath",
    icon: "🎓",
    description: "Tutor in 5+ different subjects",
    category: "mastery",
    check: (s) => s.uniqueSubjects >= 5,
  },
  {
    id: "skill_collector",
    name: "Skill Collector",
    icon: "🃏",
    description: "Add 4 strengths to your profile",
    category: "mastery",
    check: (s) => s.strengthCount >= 4,
  },

  /* ── Dedication ── */
  {
    id: "marathon_tutor",
    name: "Marathon Tutor",
    icon: "⏱️",
    description: "50+ total hours of tutoring",
    category: "dedication",
    check: (s) => s.totalHours >= 50,
  },
  {
    id: "streak_master",
    name: "Streak Master",
    icon: "🔥",
    description: "8+ consecutive active weeks",
    category: "dedication",
    check: (s) => s.streakWeeks >= 8,
  },
  {
    id: "iron_will",
    name: "Iron Will",
    icon: "💎",
    description: "4 consecutive active weeks",
    category: "dedication",
    check: (s) => s.streakWeeks >= 4,
  },
];
