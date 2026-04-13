import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/* ─────────────────────────────────────────────
   POST /api/seed
   Creates 8 realistic GSU student accounts,
   profiles, skills, matches, sessions, reviews,
   messages, forum threads & replies.
   Pass { secret: "panthertutor" } in body.
   ───────────────────────────────────────────── */

const SEED_PASSWORD = "GSUpanthers2026!";

/* ── 8 diverse GSU students ── */
const USERS = [
  {
    email: "maria.chen@student.gsu.edu",
    full_name: "Maria Chen",
    major: "Computer Science",
    year: "Junior",
    bio: "CS major specializing in AI/ML. Love hackathons and teaching data structures. Looking for study partners for algorithms! 🐾",
  },
  {
    email: "david.johnson@student.gsu.edu",
    full_name: "David Johnson",
    major: "Computer Science",
    year: "Senior",
    bio: "Full-stack developer. TA for CSC 1301. Happy to help with Java, Python, and web dev. Coffee addict ☕",
  },
  {
    email: "aisha.mohammed@student.gsu.edu",
    full_name: "Aisha Mohammed",
    major: "Biology (Pre-Med)",
    year: "Sophomore",
    bio: "Pre-med student grinding through orgo and physics. Need help with CS classes, can tutor Bio and Chem all day!",
  },
  {
    email: "carlos.rivera@student.gsu.edu",
    full_name: "Carlos Rivera",
    major: "Business Administration",
    year: "Junior",
    bio: "Business major with a minor in CS. Strong in accounting and economics. Struggling with Discrete Math 😅",
  },
  {
    email: "sarah.williams@student.gsu.edu",
    full_name: "Sarah Williams",
    major: "Mathematics",
    year: "Senior",
    bio: "Math tutor for 3 years. I make Calculus and Linear Algebra actually fun. Also learning Python for data science!",
  },
  {
    email: "james.okonkwo@student.gsu.edu",
    full_name: "James Okonkwo",
    major: "Computer Science",
    year: "Sophomore",
    bio: "New to CS but loving it. Solid in Java, need guidance on algorithms and discrete math. Let's study together!",
  },
  {
    email: "emily.park@student.gsu.edu",
    full_name: "Emily Park",
    major: "Psychology",
    year: "Junior",
    bio: "Psych major intersecting with data. Good at stats and writing. Help me survive Physics and I'll help you with research papers!",
  },
  {
    email: "alex.thompson@student.gsu.edu",
    full_name: "Alex Thompson",
    major: "Computer Science",
    year: "Freshman",
    bio: "First-year CS student. Eager to learn everything! Can help with English/Writing. Looking for mentors in programming. 💻",
  },
];

/* ── Skills assignments (skill name → strength[mastered/proficient] or weakness[needs_help]) ── */
const USER_SKILLS: Record<string, { name: string; level: "mastered" | "proficient" | "needs_help" }[]> = {
  "maria.chen@student.gsu.edu": [
    { name: "CSC 2720 - Data Structures", level: "mastered" },
    { name: "CSC 1302 - Principles of Computer Science II", level: "mastered" },
    { name: "MATH 2420 - Discrete Mathematics", level: "proficient" },
    { name: "CSC 1301 - Principles of Computer Science I", level: "mastered" },
    { name: "MATH 2211 - Calculus I", level: "needs_help" },
    { name: "PHYS 2211 - Principles of Physics I", level: "needs_help" },
  ],
  "david.johnson@student.gsu.edu": [
    { name: "CSC 1301 - Principles of Computer Science I", level: "mastered" },
    { name: "CSC 1302 - Principles of Computer Science II", level: "mastered" },
    { name: "CSC 4350 - Software Engineering", level: "proficient" },
    { name: "CSC 2720 - Data Structures", level: "proficient" },
    { name: "CSC 3210 - Computer Organization", level: "proficient" },
    { name: "ECON 2105 - Principles of Macroeconomics", level: "needs_help" },
  ],
  "aisha.mohammed@student.gsu.edu": [
    { name: "BIOL 1103 - Introductory Biology I", level: "mastered" },
    { name: "BIOL 1104 - Introductory Biology II", level: "mastered" },
    { name: "CHEM 1211 - Principles of Chemistry I", level: "mastered" },
    { name: "CHEM 1212 - Principles of Chemistry II", level: "proficient" },
    { name: "CSC 1301 - Principles of Computer Science I", level: "needs_help" },
    { name: "MATH 2211 - Calculus I", level: "needs_help" },
  ],
  "carlos.rivera@student.gsu.edu": [
    { name: "ACCT 2101 - Principles of Accounting I", level: "mastered" },
    { name: "ACCT 2102 - Principles of Accounting II", level: "proficient" },
    { name: "ECON 2105 - Principles of Macroeconomics", level: "mastered" },
    { name: "ECON 2106 - Principles of Microeconomics", level: "proficient" },
    { name: "MGS 3100 - Business Analysis", level: "proficient" },
    { name: "MATH 2420 - Discrete Mathematics", level: "needs_help" },
  ],
  "sarah.williams@student.gsu.edu": [
    { name: "MATH 2211 - Calculus I", level: "mastered" },
    { name: "MATH 2212 - Calculus II", level: "mastered" },
    { name: "MATH 2420 - Discrete Mathematics", level: "mastered" },
    { name: "MATH 1111 - College Algebra", level: "mastered" },
    { name: "CSC 1301 - Principles of Computer Science I", level: "needs_help" },
    { name: "CSC 1302 - Principles of Computer Science II", level: "needs_help" },
  ],
  "james.okonkwo@student.gsu.edu": [
    { name: "CSC 1301 - Principles of Computer Science I", level: "proficient" },
    { name: "CSC 1302 - Principles of Computer Science II", level: "proficient" },
    { name: "ENGL 1101 - English Composition I", level: "mastered" },
    { name: "CSC 2720 - Data Structures", level: "needs_help" },
    { name: "MATH 2420 - Discrete Mathematics", level: "needs_help" },
    { name: "PHYS 2211 - Principles of Physics I", level: "needs_help" },
  ],
  "emily.park@student.gsu.edu": [
    { name: "PSYC 1101 - Introduction to Psychology", level: "mastered" },
    { name: "ENGL 1101 - English Composition I", level: "mastered" },
    { name: "ENGL 1102 - English Composition II", level: "mastered" },
    { name: "MATH 1111 - College Algebra", level: "proficient" },
    { name: "PHYS 2211 - Principles of Physics I", level: "needs_help" },
    { name: "CSC 1301 - Principles of Computer Science I", level: "needs_help" },
  ],
  "alex.thompson@student.gsu.edu": [
    { name: "ENGL 1101 - English Composition I", level: "mastered" },
    { name: "ENGL 1102 - English Composition II", level: "proficient" },
    { name: "POLS 1101 - American Government", level: "proficient" },
    { name: "CSC 1301 - Principles of Computer Science I", level: "needs_help" },
    { name: "MATH 1111 - College Algebra", level: "needs_help" },
    { name: "CSC 1302 - Principles of Computer Science II", level: "needs_help" },
  ],
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.secret !== "panthertutor") {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    const log: string[] = [];

    /* ═══════════════════════════════════════
       0. Schema migration — add missing columns
       ═══════════════════════════════════════ */
    try {
      await supabaseAdmin.rpc("exec_sql" as any, {
        query: "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewee_role TEXT NOT NULL DEFAULT 'tutor' CHECK (reviewee_role IN ('tutor', 'student'))",
      });
    } catch {
      // RPC may not exist; try direct insert to test column
    }

    /* ═══════════════════════════════════════
       1. Create auth users (bypass verification)
       ═══════════════════════════════════════ */
    const userMap: Record<string, string> = {}; // email → UUID

    for (const u of USERS) {
      // Check if user already exists
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
      const found = existing?.users?.find((eu) => eu.email === u.email);

      if (found) {
        userMap[u.email] = found.id;
        log.push(`✓ User ${u.email} already exists (${found.id})`);
      } else {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: SEED_PASSWORD,
          email_confirm: true, // ← bypasses verification!
          user_metadata: { full_name: u.full_name },
        });
        if (error) {
          log.push(`✗ Failed to create ${u.email}: ${error.message}`);
          continue;
        }
        userMap[u.email] = data.user.id;
        log.push(`✓ Created ${u.email} (${data.user.id})`);
      }
    }

    /* ═══════════════════════════════════════
       2. Upsert profiles
       ═══════════════════════════════════════ */
    for (const u of USERS) {
      const uid = userMap[u.email];
      if (!uid) continue;

      const { error } = await supabaseAdmin.from("profiles").upsert(
        {
          id: uid,
          full_name: u.full_name,
          major: u.major,
          year: u.year,
          bio: u.bio,
        },
        { onConflict: "id" }
      );
      if (error) log.push(`✗ Profile ${u.email}: ${error.message}`);
      else log.push(`✓ Profile upserted: ${u.full_name}`);
    }

    /* ═══════════════════════════════════════
       3. Fetch skill IDs
       ═══════════════════════════════════════ */
    const { data: allSkills } = await supabaseAdmin.from("skills").select("id, name");
    const skillMap: Record<string, number> = {};
    (allSkills || []).forEach((s: any) => {
      skillMap[s.name] = s.id;
    });
    log.push(`✓ Found ${Object.keys(skillMap).length} skills in DB`);

    /* ═══════════════════════════════════════
       4. Assign user skills
       ═══════════════════════════════════════ */
    for (const [email, skills] of Object.entries(USER_SKILLS)) {
      const uid = userMap[email];
      if (!uid) continue;

      for (const s of skills) {
        const skillId = skillMap[s.name];
        if (!skillId) {
          log.push(`✗ Skill not found: ${s.name}`);
          continue;
        }
        const { error } = await supabaseAdmin.from("user_skills").upsert(
          { user_id: uid, skill_id: skillId, level: s.level },
          { onConflict: "user_id,skill_id,level" }
        );
        if (error && !error.message.includes("duplicate")) {
          log.push(`✗ Skill ${s.name} for ${email}: ${error.message}`);
        }
      }
      log.push(`✓ Skills assigned for ${email}`);
    }

    /* ═══════════════════════════════════════
       5. Create matches (accepted connections)
       ═══════════════════════════════════════ */
    const matchPairs: [string, string, number, string[]][] = [
      ["maria.chen@student.gsu.edu", "david.johnson@student.gsu.edu", 92, ["Data Structures", "CS II"]],
      ["maria.chen@student.gsu.edu", "sarah.williams@student.gsu.edu", 88, ["Calculus I", "Discrete Math"]],
      ["aisha.mohammed@student.gsu.edu", "david.johnson@student.gsu.edu", 78, ["CS I", "Biology"]],
      ["aisha.mohammed@student.gsu.edu", "sarah.williams@student.gsu.edu", 85, ["Calculus I", "Chemistry"]],
      ["carlos.rivera@student.gsu.edu", "maria.chen@student.gsu.edu", 75, ["Discrete Math", "Economics"]],
      ["carlos.rivera@student.gsu.edu", "emily.park@student.gsu.edu", 70, ["Business Analysis", "Psychology"]],
      ["james.okonkwo@student.gsu.edu", "maria.chen@student.gsu.edu", 90, ["Data Structures", "English"]],
      ["james.okonkwo@student.gsu.edu", "david.johnson@student.gsu.edu", 86, ["CS II", "Writing"]],
      ["emily.park@student.gsu.edu", "sarah.williams@student.gsu.edu", 72, ["College Algebra", "English"]],
      ["alex.thompson@student.gsu.edu", "david.johnson@student.gsu.edu", 83, ["CS I", "English"]],
      ["alex.thompson@student.gsu.edu", "james.okonkwo@student.gsu.edu", 79, ["CS I", "English"]],
      ["sarah.williams@student.gsu.edu", "david.johnson@student.gsu.edu", 81, ["CS I", "Calculus"]],
    ];

    const matchIds: number[] = [];
    for (const [e1, e2, score, skills] of matchPairs) {
      const u1 = userMap[e1], u2 = userMap[e2];
      if (!u1 || !u2) continue;

      // Check if match already exists
      const { data: existing } = await supabaseAdmin
        .from("matches")
        .select("id")
        .or(`and(user1_id.eq.${u1},user2_id.eq.${u2}),and(user1_id.eq.${u2},user2_id.eq.${u1})`)
        .limit(1);

      if (existing && existing.length > 0) {
        matchIds.push(existing[0].id);
        log.push(`✓ Match ${e1} ↔ ${e2} already exists`);
      } else {
        const { data, error } = await supabaseAdmin.from("matches").insert({
          user1_id: u1,
          user2_id: u2,
          score,
          status: "accepted",
        }).select("id").single();
        if (error) log.push(`✗ Match ${e1} ↔ ${e2}: ${error.message}`);
        else {
          matchIds.push(data.id);
          log.push(`✓ Match created: ${e1} ↔ ${e2} (score: ${score})`);
        }
      }
    }

    /* ═══════════════════════════════════════
       6. Create sessions (mix of completed, scheduled, cancelled)
       ═══════════════════════════════════════ */
    const now = new Date();
    function daysAgo(d: number) {
      return new Date(now.getTime() - d * 86400000).toISOString();
    }
    function daysFromNow(d: number) {
      return new Date(now.getTime() + d * 86400000).toISOString();
    }

    const sessionDefs: {
      tutor: string; student: string; subject: string;
      scheduled_at: string; duration: number; status: string; notes: string;
    }[] = [
      // Completed sessions (past)
      { tutor: "david.johnson@student.gsu.edu", student: "alex.thompson@student.gsu.edu", subject: "CSC 1301 - Principles of Computer Science I", scheduled_at: daysAgo(45), duration: 60, status: "completed", notes: "Intro to Java basics, variables, loops" },
      { tutor: "maria.chen@student.gsu.edu", student: "james.okonkwo@student.gsu.edu", subject: "CSC 2720 - Data Structures", scheduled_at: daysAgo(40), duration: 90, status: "completed", notes: "Linked lists and Big-O notation" },
      { tutor: "sarah.williams@student.gsu.edu", student: "aisha.mohammed@student.gsu.edu", subject: "MATH 2211 - Calculus I", scheduled_at: daysAgo(38), duration: 60, status: "completed", notes: "Limits and derivatives review" },
      { tutor: "aisha.mohammed@student.gsu.edu", student: "david.johnson@student.gsu.edu", subject: "BIOL 1103 - Introductory Biology I", scheduled_at: daysAgo(35), duration: 45, status: "completed", notes: "Cell structure and mitosis" },
      { tutor: "carlos.rivera@student.gsu.edu", student: "emily.park@student.gsu.edu", subject: "ECON 2105 - Principles of Macroeconomics", scheduled_at: daysAgo(32), duration: 60, status: "completed", notes: "Supply/demand curves and equilibrium" },
      { tutor: "david.johnson@student.gsu.edu", student: "james.okonkwo@student.gsu.edu", subject: "CSC 1302 - Principles of Computer Science II", scheduled_at: daysAgo(30), duration: 75, status: "completed", notes: "Recursion and binary trees" },
      { tutor: "sarah.williams@student.gsu.edu", student: "maria.chen@student.gsu.edu", subject: "MATH 2211 - Calculus I", scheduled_at: daysAgo(28), duration: 60, status: "completed", notes: "Integration techniques" },
      { tutor: "maria.chen@student.gsu.edu", student: "carlos.rivera@student.gsu.edu", subject: "MATH 2420 - Discrete Mathematics", scheduled_at: daysAgo(25), duration: 60, status: "completed", notes: "Proof by induction and sets" },
      { tutor: "emily.park@student.gsu.edu", student: "alex.thompson@student.gsu.edu", subject: "ENGL 1101 - English Composition I", scheduled_at: daysAgo(22), duration: 45, status: "completed", notes: "Essay structure and thesis writing" },
      { tutor: "david.johnson@student.gsu.edu", student: "aisha.mohammed@student.gsu.edu", subject: "CSC 1301 - Principles of Computer Science I", scheduled_at: daysAgo(20), duration: 60, status: "completed", notes: "Functions, arrays, and debugging" },
      { tutor: "sarah.williams@student.gsu.edu", student: "carlos.rivera@student.gsu.edu", subject: "MATH 2420 - Discrete Mathematics", scheduled_at: daysAgo(18), duration: 60, status: "completed", notes: "Graph theory basics" },
      { tutor: "maria.chen@student.gsu.edu", student: "alex.thompson@student.gsu.edu", subject: "CSC 1301 - Principles of Computer Science I", scheduled_at: daysAgo(15), duration: 60, status: "completed", notes: "Object-oriented programming intro" },
      { tutor: "aisha.mohammed@student.gsu.edu", student: "emily.park@student.gsu.edu", subject: "CHEM 1211 - Principles of Chemistry I", scheduled_at: daysAgo(12), duration: 60, status: "completed", notes: "Stoichiometry and molar calculations" },
      { tutor: "david.johnson@student.gsu.edu", student: "alex.thompson@student.gsu.edu", subject: "CSC 1301 - Principles of Computer Science I", scheduled_at: daysAgo(10), duration: 60, status: "completed", notes: "File I/O and exception handling" },
      { tutor: "sarah.williams@student.gsu.edu", student: "james.okonkwo@student.gsu.edu", subject: "MATH 2420 - Discrete Mathematics", scheduled_at: daysAgo(8), duration: 90, status: "completed", notes: "Combinatorics and counting" },
      { tutor: "maria.chen@student.gsu.edu", student: "james.okonkwo@student.gsu.edu", subject: "CSC 2720 - Data Structures", scheduled_at: daysAgo(5), duration: 60, status: "completed", notes: "Hash tables and balanced BSTs" },
      { tutor: "carlos.rivera@student.gsu.edu", student: "david.johnson@student.gsu.edu", subject: "ECON 2105 - Principles of Macroeconomics", scheduled_at: daysAgo(3), duration: 45, status: "completed", notes: "GDP, inflation, and fiscal policy" },

      // Cancelled session
      { tutor: "sarah.williams@student.gsu.edu", student: "emily.park@student.gsu.edu", subject: "MATH 1111 - College Algebra", scheduled_at: daysAgo(14), duration: 60, status: "cancelled", notes: "Cancelled — scheduling conflict" },

      // Upcoming scheduled sessions (future)
      { tutor: "david.johnson@student.gsu.edu", student: "alex.thompson@student.gsu.edu", subject: "CSC 1302 - Principles of Computer Science II", scheduled_at: daysFromNow(2), duration: 60, status: "scheduled", notes: "Inheritance and polymorphism" },
      { tutor: "maria.chen@student.gsu.edu", student: "carlos.rivera@student.gsu.edu", subject: "MATH 2420 - Discrete Mathematics", scheduled_at: daysFromNow(3), duration: 90, status: "scheduled", notes: "Final exam review" },
      { tutor: "sarah.williams@student.gsu.edu", student: "aisha.mohammed@student.gsu.edu", subject: "MATH 2212 - Calculus II", scheduled_at: daysFromNow(4), duration: 60, status: "scheduled", notes: "Series and sequences" },
      { tutor: "aisha.mohammed@student.gsu.edu", student: "emily.park@student.gsu.edu", subject: "BIOL 1103 - Introductory Biology I", scheduled_at: daysFromNow(5), duration: 45, status: "scheduled", notes: "Genetics basics" },
      { tutor: "emily.park@student.gsu.edu", student: "james.okonkwo@student.gsu.edu", subject: "ENGL 1101 - English Composition I", scheduled_at: daysFromNow(6), duration: 60, status: "scheduled", notes: "Research paper outline" },
    ];

    const sessionIdMap: Record<string, number> = {};
    let sessIdx = 0;
    for (const s of sessionDefs) {
      const tutorId = userMap[s.tutor], studentId = userMap[s.student];
      if (!tutorId || !studentId) continue;

      const skillId = skillMap[s.subject] || null;

      const { data, error } = await supabaseAdmin.from("sessions").insert({
        user1_id: tutorId,
        user2_id: studentId,
        skill_id: skillId,
        subject: s.subject,
        scheduled_at: s.scheduled_at,
        duration_minutes: s.duration,
        status: s.status,
        notes: s.notes,
      }).select("id").single();

      if (error) log.push(`✗ Session ${s.subject}: ${error.message}`);
      else {
        sessionIdMap[`sess_${sessIdx}`] = data.id;
        log.push(`✓ Session: ${s.subject} (${s.status})`);
      }
      sessIdx++;
    }

    /* ═══════════════════════════════════════
       7. Create reviews (for completed sessions)
       ═══════════════════════════════════════ */
    const reviewDefs: {
      sessKey: string; reviewer: string; reviewee: string; role: string;
      rating: number; text: string;
    }[] = [
      // Session 0: David → Alex (CS I)
      { sessKey: "sess_0", reviewer: "alex.thompson@student.gsu.edu", reviewee: "david.johnson@student.gsu.edu", role: "tutor", rating: 5, text: "David is an amazing tutor! Explained Java basics so clearly. Will definitely book again." },
      { sessKey: "sess_0", reviewer: "david.johnson@student.gsu.edu", reviewee: "alex.thompson@student.gsu.edu", role: "student", rating: 4, text: "Alex came prepared with questions. Great attitude! Just needs to practice more on his own." },
      // Session 1: Maria → James (Data Structures)
      { sessKey: "sess_1", reviewer: "james.okonkwo@student.gsu.edu", reviewee: "maria.chen@student.gsu.edu", role: "tutor", rating: 5, text: "Maria breaks down complex topics like linked lists perfectly. The Big-O explanation finally clicked!" },
      { sessKey: "sess_1", reviewer: "maria.chen@student.gsu.edu", reviewee: "james.okonkwo@student.gsu.edu", role: "student", rating: 5, text: "James is a dedicated learner. He asks great questions and takes thorough notes." },
      // Session 2: Sarah → Aisha (Calc I)
      { sessKey: "sess_2", reviewer: "aisha.mohammed@student.gsu.edu", reviewee: "sarah.williams@student.gsu.edu", role: "tutor", rating: 5, text: "Sarah makes calculus fun! She has creative ways to explain limits and derivatives." },
      { sessKey: "sess_2", reviewer: "sarah.williams@student.gsu.edu", reviewee: "aisha.mohammed@student.gsu.edu", role: "student", rating: 4, text: "Aisha is very focused but could benefit from reviewing prerequisite material before sessions." },
      // Session 3: Aisha → David (Bio)
      { sessKey: "sess_3", reviewer: "david.johnson@student.gsu.edu", reviewee: "aisha.mohammed@student.gsu.edu", role: "tutor", rating: 5, text: "Aisha really knows her biology! Made cell biology interesting even for a CS guy like me." },
      // Session 5: David → James (CS II)
      { sessKey: "sess_5", reviewer: "james.okonkwo@student.gsu.edu", reviewee: "david.johnson@student.gsu.edu", role: "tutor", rating: 4, text: "David's recursion explanation was solid. Would have liked more practice problems though." },
      // Session 6: Sarah → Maria (Calc I)
      { sessKey: "sess_6", reviewer: "maria.chen@student.gsu.edu", reviewee: "sarah.williams@student.gsu.edu", role: "tutor", rating: 5, text: "Integration clicked after this session! Sarah is patient and thorough." },
      // Session 7: Maria → Carlos (Discrete Math)
      { sessKey: "sess_7", reviewer: "carlos.rivera@student.gsu.edu", reviewee: "maria.chen@student.gsu.edu", role: "tutor", rating: 4, text: "Maria explained proofs well. The induction examples really helped." },
      { sessKey: "sess_7", reviewer: "maria.chen@student.gsu.edu", reviewee: "carlos.rivera@student.gsu.edu", role: "student", rating: 4, text: "Carlos is eager to learn. He should try working through more proofs independently." },
      // Session 9: David → Aisha (CS I)
      { sessKey: "sess_9", reviewer: "aisha.mohammed@student.gsu.edu", reviewee: "david.johnson@student.gsu.edu", role: "tutor", rating: 5, text: "David is super patient! He helped me debug my first Java program step by step." },
      // Session 11: Maria → Alex (CS I)
      { sessKey: "sess_11", reviewer: "alex.thompson@student.gsu.edu", reviewee: "maria.chen@student.gsu.edu", role: "tutor", rating: 5, text: "Maria made OOP concepts click! She used real-world examples that made everything intuitive." },
      // Session 13: David → Alex (CS I)
      { sessKey: "sess_13", reviewer: "alex.thompson@student.gsu.edu", reviewee: "david.johnson@student.gsu.edu", role: "tutor", rating: 5, text: "Third session with David and I keep learning more. Exception handling is no longer scary!" },
      // Session 15: Maria → James (Data Structures)
      { sessKey: "sess_15", reviewer: "james.okonkwo@student.gsu.edu", reviewee: "maria.chen@student.gsu.edu", role: "tutor", rating: 5, text: "Hash tables and BSTs! Maria's visualizations on the whiteboard were so helpful." },
      // Session 16: Carlos → David (Econ)
      { sessKey: "sess_16", reviewer: "david.johnson@student.gsu.edu", reviewee: "carlos.rivera@student.gsu.edu", role: "tutor", rating: 4, text: "Carlos knows his econ! The GDP breakdown was exactly what I needed for my exam." },
    ];

    for (const r of reviewDefs) {
      const sessionId = sessionIdMap[r.sessKey];
      const reviewerId = userMap[r.reviewer];
      const revieweeId = userMap[r.reviewee];
      if (!sessionId || !reviewerId || !revieweeId) continue;

      const { error } = await supabaseAdmin.from("reviews").upsert(
        {
          session_id: sessionId,
          reviewer_id: reviewerId,
          reviewee_id: revieweeId,
          reviewee_role: r.role,
          rating: r.rating,
          review_text: r.text,
        },
        { onConflict: "session_id,reviewer_id" }
      );
      if (error) log.push(`✗ Review: ${error.message}`);
      else log.push(`✓ Review: ${r.reviewer.split("@")[0]} → ${r.reviewee.split("@")[0]} (${r.rating}★)`);
    }

    /* ═══════════════════════════════════════
       8. Create messages (chat between matched users)
       ═══════════════════════════════════════ */
    if (matchIds.length >= 6) {
      const msgDefs: { matchIdx: number; sender: string; content: string; minutesAgo: number }[] = [
        // Maria ↔ David
        { matchIdx: 0, sender: "maria.chen@student.gsu.edu", content: "Hey David! Thanks for accepting my match request 🙌", minutesAgo: 4320 },
        { matchIdx: 0, sender: "david.johnson@student.gsu.edu", content: "Of course! I see we're both in CS. What topics do you want to focus on?", minutesAgo: 4260 },
        { matchIdx: 0, sender: "maria.chen@student.gsu.edu", content: "I'm great at Data Structures but need help with algorithms optimization. Could we do a study swap?", minutesAgo: 4200 },
        { matchIdx: 0, sender: "david.johnson@student.gsu.edu", content: "Absolutely! I'm solid with algorithms. Let's book a session this week?", minutesAgo: 4140 },
        { matchIdx: 0, sender: "maria.chen@student.gsu.edu", content: "Perfect! How about Thursday at 3pm?", minutesAgo: 4080 },

        // Maria ↔ Sarah
        { matchIdx: 1, sender: "sarah.williams@student.gsu.edu", content: "Hi Maria! Saw you need help with Calculus. I've been tutoring Calc for 3 years 😊", minutesAgo: 3000 },
        { matchIdx: 1, sender: "maria.chen@student.gsu.edu", content: "Omg yes please! Integration is destroying me right now 😭", minutesAgo: 2940 },
        { matchIdx: 1, sender: "sarah.williams@student.gsu.edu", content: "Haha don't worry, once you learn the tricks it becomes second nature. Book a session whenever!", minutesAgo: 2880 },
        { matchIdx: 1, sender: "maria.chen@student.gsu.edu", content: "Just booked one! You're a lifesaver 🙏", minutesAgo: 2820 },

        // James ↔ Maria
        { matchIdx: 6, sender: "james.okonkwo@student.gsu.edu", content: "Hey Maria! I'm struggling with Data Structures. Your profile says you mastered it?", minutesAgo: 2000 },
        { matchIdx: 6, sender: "maria.chen@student.gsu.edu", content: "Yes! Data structures is my thing. What specifically are you stuck on?", minutesAgo: 1940 },
        { matchIdx: 6, sender: "james.okonkwo@student.gsu.edu", content: "Linked lists mostly, and Big-O analysis. Can never figure out the time complexity.", minutesAgo: 1880 },
        { matchIdx: 6, sender: "maria.chen@student.gsu.edu", content: "Those are super common pain points. Let's book a session and I'll walk you through it step by step!", minutesAgo: 1820 },
        { matchIdx: 6, sender: "james.okonkwo@student.gsu.edu", content: "Just booked! Thanks so much 🔥", minutesAgo: 1760 },

        // Alex ↔ David
        { matchIdx: 9, sender: "alex.thompson@student.gsu.edu", content: "Hi David! I'm a freshman and really need help with CS I. Saw you're a TA?", minutesAgo: 1500 },
        { matchIdx: 9, sender: "david.johnson@student.gsu.edu", content: "Hey Alex! Yes I TA for CSC 1301. Happy to help — what are you working on now?", minutesAgo: 1440 },
        { matchIdx: 9, sender: "alex.thompson@student.gsu.edu", content: "We just started Java and I'm confused about everything honestly 😅", minutesAgo: 1380 },
        { matchIdx: 9, sender: "david.johnson@student.gsu.edu", content: "Totally normal for week 1! Let's start with the basics. I booked us a session — looking forward to it!", minutesAgo: 1320 },
        { matchIdx: 9, sender: "alex.thompson@student.gsu.edu", content: "Thank you so much! This platform is awesome btw 🐾", minutesAgo: 1260 },

        // Recent messages (today / yesterday)
        { matchIdx: 0, sender: "david.johnson@student.gsu.edu", content: "Hey Maria, want to do another session this week? Maybe cover sorting algorithms?", minutesAgo: 120 },
        { matchIdx: 0, sender: "maria.chen@student.gsu.edu", content: "Yes! I've been practicing merge sort. Let's do Wednesday?", minutesAgo: 60 },
        { matchIdx: 6, sender: "james.okonkwo@student.gsu.edu", content: "Maria! Hash tables session was incredible. I aced my quiz today!! 🎉", minutesAgo: 30 },
      ];

      for (const m of msgDefs) {
        const matchId = matchIds[m.matchIdx];
        const senderId = userMap[m.sender];
        if (!matchId || !senderId) continue;

        const createdAt = new Date(now.getTime() - m.minutesAgo * 60000).toISOString();
        const { error } = await supabaseAdmin.from("messages").insert({
          match_id: matchId,
          sender_id: senderId,
          content: m.content,
          created_at: createdAt,
        });
        if (error) log.push(`✗ Message: ${error.message}`);
      }
      log.push(`✓ ${msgDefs.length} messages created`);
    }

    /* ═══════════════════════════════════════
       9. Create forum threads & replies
       ═══════════════════════════════════════ */
    const dsSkillId = skillMap["CSC 2720 - Data Structures"];
    const cs1SkillId = skillMap["CSC 1301 - Principles of Computer Science I"];
    const calcSkillId = skillMap["MATH 2211 - Calculus I"];
    const econSkillId = skillMap["ECON 2105 - Principles of Macroeconomics"];
    const psycSkillId = skillMap["PSYC 1101 - Introduction to Psychology"];

    const forumThreads: {
      author: string; skill_id: number; title: string; body: string;
      tag: string; is_resolved: boolean;
    }[] = [
      {
        author: "james.okonkwo@student.gsu.edu",
        skill_id: dsSkillId,
        title: "How to choose between HashMap and TreeMap in Java?",
        body: "I understand that HashMap is O(1) and TreeMap is O(log n) for basic operations, but when would you actually prefer TreeMap? Are there real-world scenarios where the sorted order matters enough to sacrifice performance?",
        tag: "question",
        is_resolved: true,
      },
      {
        author: "alex.thompson@student.gsu.edu",
        skill_id: cs1SkillId,
        title: "Tips for debugging Java programs?",
        body: "I keep getting NullPointerExceptions and ArrayIndexOutOfBoundsException. What are some strategies you use to debug your code? I usually just stare at it until something clicks 😅",
        tag: "question",
        is_resolved: false,
      },
      {
        author: "aisha.mohammed@student.gsu.edu",
        skill_id: calcSkillId,
        title: "Best resources for Calculus II preparation?",
        body: "I passed Calc I with Sarah's help (shoutout!) but Calc II looks intense. Any YouTube channels, textbooks, or practice sites you'd recommend? Especially for series and sequences.",
        tag: "discussion",
        is_resolved: false,
      },
      {
        author: "carlos.rivera@student.gsu.edu",
        skill_id: econSkillId,
        title: "Study group for Macroeconomics final?",
        body: "The final is in 3 weeks and I want to start a study group. We can meet at the library or use PantherTutor to book group sessions. Who's in? 📚",
        tag: "discussion",
        is_resolved: false,
      },
      {
        author: "emily.park@student.gsu.edu",
        skill_id: psycSkillId,
        title: "Applying psychological principles to better studying",
        body: "As a psych major, I've been experimenting with spaced repetition, active recall, and interleaving. Here are my findings after a semester of tracking my grades...\n\n1. **Spaced repetition** → improved my test scores by ~15%\n2. **Active recall** → way better than re-reading notes\n3. **Interleaving** → helps with problem-solving courses like math\n\nAnyone else tried evidence-based study methods?",
        tag: "discussion",
        is_resolved: false,
      },
    ];

    const threadIds: number[] = [];
    for (const t of forumThreads) {
      const authorId = userMap[t.author];
      if (!authorId || !t.skill_id) continue;

      const { data, error } = await supabaseAdmin.from("forum_threads").insert({
        author_id: authorId,
        skill_id: t.skill_id,
        title: t.title,
        body: t.body,
        tag: t.tag,
        is_resolved: t.is_resolved,
      }).select("id").single();

      if (error) log.push(`✗ Thread: ${error.message}`);
      else {
        threadIds.push(data.id);
        log.push(`✓ Thread: ${t.title.slice(0, 40)}...`);
      }
    }

    // Replies
    if (threadIds.length >= 3) {
      const replies: { threadIdx: number; author: string; body: string }[] = [
        // Thread 0 replies (HashMap vs TreeMap)
        { threadIdx: 0, author: "maria.chen@student.gsu.edu", body: "Great question! Use TreeMap when you need sorted iteration — like implementing a leaderboard or range queries. For example, `subMap()` lets you get all entries between two keys in O(log n). HashMap can't do that." },
        { threadIdx: 0, author: "david.johnson@student.gsu.edu", body: "Maria nailed it. I'd add that TreeMap implements NavigableMap which gives you `floorKey()`, `ceilingKey()`, etc. These are super useful for scheduling algorithms or calendar apps." },
        { threadIdx: 0, author: "james.okonkwo@student.gsu.edu", body: "This makes so much sense now! Thank you both — marking as resolved ✅" },

        // Thread 1 replies (debugging tips)
        { threadIdx: 1, author: "david.johnson@student.gsu.edu", body: "As a TA, I see this all the time! Here are my top 3 tips:\n1. Read the stack trace — it tells you the exact line number\n2. Use print statements (System.out.println) before the crash\n3. Check if variables are null before using them\n\nAlso, learn to use your IDE's debugger — breakpoints are your best friend!" },
        { threadIdx: 1, author: "maria.chen@student.gsu.edu", body: "Adding to David's tips: always initialize your arrays/lists before using them, and be careful with loop boundaries (use `< array.length` not `<= array.length`). Those two things fix like 80% of beginner bugs." },

        // Thread 2 replies (Calc II resources)
        { threadIdx: 2, author: "sarah.williams@student.gsu.edu", body: "So glad Calc I went well! For Calc II:\n- **3Blue1Brown** on YouTube for intuition\n- **Professor Leonard** for detailed lectures\n- **Paul's Online Math Notes** for practice\n\nAnd of course, book sessions with me anytime! 😊" },
        { threadIdx: 2, author: "maria.chen@student.gsu.edu", body: "I used Khan Academy when I took Calc II — their practice problems are really good. Sarah is also THE best tutor for this, trust me!" },

        // Thread 4 replies (study methods)
        { threadIdx: 4, author: "sarah.williams@student.gsu.edu", body: "Spaced repetition changed my life! I use Anki flashcards for all my math formulas. My retention went from maybe 60% to over 90%." },
        { threadIdx: 4, author: "james.okonkwo@student.gsu.edu", body: "Active recall is so hard but it works. I started doing practice problems from scratch instead of looking at solutions and my Data Structures grade went up a whole letter." },
      ];

      for (const r of replies) {
        const authorId = userMap[r.author];
        const threadId = threadIds[r.threadIdx];
        if (!authorId || !threadId) continue;

        const { error } = await supabaseAdmin.from("forum_replies").insert({
          thread_id: threadId,
          author_id: authorId,
          body: r.body,
        });
        if (error) log.push(`✗ Reply: ${error.message}`);
      }

      // Update reply counts
      for (let i = 0; i < threadIds.length; i++) {
        const { count } = await supabaseAdmin
          .from("forum_replies")
          .select("*", { count: "exact", head: true })
          .eq("thread_id", threadIds[i]);
        await supabaseAdmin
          .from("forum_threads")
          .update({ reply_count: count || 0 })
          .eq("id", threadIds[i]);
      }
      log.push(`✓ Forum replies created`);
    }

    /* ═══════════════════════════════════════
       10. Summary
       ═══════════════════════════════════════ */
    return NextResponse.json({
      success: true,
      usersCreated: Object.keys(userMap).length,
      password: SEED_PASSWORD,
      accounts: USERS.map((u) => ({
        email: u.email,
        name: u.full_name,
        major: u.major,
        year: u.year,
      })),
      log,
    });
  } catch (e: any) {
    console.error("Seed error:", e);
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
