# 🐾 PantherTutor

A peer-to-peer tutoring platform built for Georgia State University students. PantherTutor connects students with peer tutors, tracks learning progress, and fosters a collaborative academic community.

**Live:** https://panthertutor.vercel.app

---

## Features

- **Smart Matching** — Algorithm matches students with tutors based on skills, major, and availability
- **Session Booking** — Schedule, manage, and track tutoring sessions
- **Reviews & Ratings** — Rate tutors and students after sessions
- **Community Forum** — Ask questions, share resources, upvote answers
- **Progress Tracker** — Visual milestones, streaks, and learning stats
- **Badges & Achievements** — Earn badges for sessions, reviews, and community contributions
- **AI Chatbot (PantherBot)** — GPT-4o-mini powered assistant for academic help
- **Practice Generator** — AI-generated practice questions by subject
- **Social Share Cards** — Generate and share achievement cards to Twitter/LinkedIn
- **Public Profiles** — Showcase skills, badges, and tutoring history
- **Dark Mode** — Full dark/light theme support
- **Real-time Dashboard** — Live stats, quick actions, and activity feed

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, TailwindCSS 4 |
| Backend | Next.js API Routes (Node.js runtime) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email + Google OAuth) |
| AI | OpenAI GPT-4o-mini |
| Deployment | Vercel |

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/programmeryusha/Tutoring-System.git
cd Tutoring-System
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Database Setup

The schema is in `supabase-schema.sql`. Run it in the **Supabase SQL Editor** to create all tables with RLS policies.

To seed sample data, visit `/api/seed` while running locally.

---

## Project Structure

```
src/
├── app/
│   ├── api/          # Backend API routes
│   ├── dashboard/    # Main dashboard
│   ├── sessions/     # Session booking & management
│   ├── forum/        # Community forum
│   ├── progress/     # Progress tracker
│   ├── share/        # Social share card generator
│   └── profile/      # Public user profiles
├── components/       # Shared UI components (Navbar, AuthProvider, etc.)
└── lib/              # Supabase client, badges logic, DB helpers
```

---

## Team

Built by GSU students for CSC 4350 — Software Engineering, Spring 2026.

---

## Security

PantherTutor implements multiple layers of security:

| Measure | Implementation |
|---|---|
| **HTTPS / SSL** | Enforced automatically by Vercel on all traffic |
| **SQL Injection Prevention** | Supabase uses parameterized queries — no raw SQL from user input |
| **XSS Protection** | Server-side sanitizer (`src/lib/sanitize.ts`) strips HTML tags from all user-submitted content before DB storage |
| **Brute-Force Login Protection** | Client-side lockout after 5 failed attempts (30s lockout); server rate limiter via `src/lib/rateLimit.ts` |
| **Row-Level Security (RLS)** | Every Supabase table has RLS policies — users can only access their own data |
| **Secure Sessions** | Supabase Auth uses signed JWT tokens; sessions are HTTP-only and managed server-side |
| **Rate Limiting** | API routes (forum, replies) are rate-limited per IP to prevent abuse |

---

## Performance Optimizations

- **CDN** — Vercel Edge Network serves all static assets and pages from CDN globally
- **Code Splitting** — Next.js App Router automatically splits bundles per route
- **Font Optimization** — `next/font` ensures optimal font loading with zero layout shift
- **Image Optimization** — Next.js `<Image>` component with lazy loading
- **Minification** — Next.js production builds minify JS and CSS automatically

---

## Deployment & Infrastructure

- **Hosting:** Vercel (serverless, auto-scaling)
- **Database:** Supabase managed PostgreSQL (free tier)
- **CI/CD:** GitHub Actions — lints, type-checks, and deploys on every push to `main`
- **Monitoring:** Vercel Analytics tracks page views, performance, and user traffic

### GitHub Actions Pipeline

The workflow in `.github/workflows/deploy.yml`:
1. Runs ESLint on every push/PR
2. Runs TypeScript type check
3. On merge to `main` — auto-deploys to Vercel production

### Vercel Secrets Required

Add these in **Vercel Project Settings → Environment Variables** and **GitHub Repo → Settings → Secrets**:

```
VERCEL_TOKEN        # From vercel.com/account/tokens
VERCEL_ORG_ID       # From vercel.com/account
VERCEL_PROJECT_ID   # From your project settings
```

---

## Traffic Monitoring

Vercel Analytics is enabled — view real-time traffic at:
**vercel.com → your project → Analytics**

Tracks: page views, unique visitors, top pages, Web Vitals (LCP, FID, CLS).

