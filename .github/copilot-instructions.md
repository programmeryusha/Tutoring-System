# Tutoring System - Copilot Instructions

## Project Overview
This is a **Next.js 16** application with a **PostgreSQL** backend. The system uses the App Router pattern with API routes for backend logic.

**Key Stack:**
- Frontend: React 19, Next.js 16, TypeScript, TailwindCSS 4
- Backend: Node.js runtime, PostgreSQL (pg driver)
- Security: bcryptjs for password hashing

## Architecture

### Directory Structure
```
src/
├── app/
│   └── api/              # API routes (Next.js App Router)
│       └── test/route.ts # Example: GET endpoint to test DB connection
└── lib/
    └── db.ts            # PostgreSQL connection pool (singleton pattern)
```

### Database Connection
The project uses a **singleton `Pool` instance** in `src/lib/db.ts`:
```typescript
import { pool } from "../lib/db";
export async function GET() {
  const result = await pool.query("select now()");
  // Pool handles connection reuse automatically
}
```
- **Connection string:** `process.env.DATABASE_URL`
- **SSL:** Enabled with `rejectUnauthorized: false` (typical for managed databases)
- Pattern: Import and use `pool` directly, don't create new connections

## Development Workflow

### Common Commands
```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm start        # Run production server
npm run lint     # Run ESLint checks
```

### Database Setup
Set `DATABASE_URL` in `.env.local`:
```
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

## Code Conventions

### API Routes
- Use `src/app/api/[route]/route.ts` for endpoints (App Router)
- Export `async function GET()`, `POST()`, etc.
- Use `NextResponse.json()` for responses
- Set `export const runtime = "nodejs"` for full Node.js capabilities (e.g., database access)
- Error handling: catch exceptions and return 500 status with error message

### TypeScript
- Strict mode enabled (`"strict": true`)
- Path alias `@/*` maps to `src/`
- Use `@types/pg` for type safety with database queries

## Key Integration Points

### Adding Database Queries
1. Import pool: `import { pool } from "@/lib/db"`
2. Execute queries: `await pool.query(sql, [params])`
3. Example pattern in `src/app/api/test/route.ts`

### Adding New API Routes
Create `src/app/api/[feature]/route.ts`, export typed handler functions:
```typescript
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    // Process with pool.query()
    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

## Testing & Validation
- **Linting:** Enforces Next.js + TypeScript rules via eslint-config-next
- **Type checking:** `tsc` runs automatically in strict mode
- DB endpoint: `/api/test` - GET request to verify database connectivity

## Important Notes
- **Runtime:** API routes default to serverless; use `export const runtime = "nodejs"` for persistent DB connections
- **Credentials:** Use environment variables (`.env.local`) for all secrets
- **Password hashing:** Use `bcryptjs` throughout the application (already installed)
