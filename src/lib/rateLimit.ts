/**
 * Simple in-memory rate limiter for Next.js API routes.
 * Prevents brute-force attacks by limiting requests per IP.
 *
 * Usage:
 *   const result = rateLimit(req, { limit: 5, windowMs: 60_000 });
 *   if (!result.allowed) return NextResponse.json({ error: result.message }, { status: 429 });
 */

interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  message: string;
}

// In-memory store: ip -> { count, resetAt }
const store = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (now > val.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

export function rateLimit(
  req: Request,
  options: RateLimitOptions
): RateLimitResult {
  const { limit, windowMs } = options;

  // Get IP from headers (Vercel sets x-forwarded-for)
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";

  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    // First request or window expired — reset
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, message: "" };
  }

  entry.count += 1;

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      message: `Too many requests. Please try again in ${retryAfter} seconds.`,
    };
  }

  return { allowed: true, remaining: limit - entry.count, message: "" };
}
