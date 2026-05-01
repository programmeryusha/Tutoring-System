/**
 * Server-side input sanitizer to prevent XSS attacks.
 * Strips HTML tags and dangerous characters from user-submitted text.
 *
 * Usage:
 *   import { sanitize } from "@/lib/sanitize";
 *   const clean = sanitize(userInput);
 */

/**
 * Strips all HTML tags and encodes dangerous characters.
 * Safe to use in API routes before storing to database.
 */
export function sanitize(input: string): string {
  if (typeof input !== "string") return "";

  return input
    // Remove all HTML tags
    .replace(/<[^>]*>/g, "")
    // Encode dangerous characters
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    // Remove null bytes
    .replace(/\0/g, "")
    .trim();
}

/**
 * Sanitizes but preserves forward slashes (for URLs, code snippets etc).
 * Use for forum body content where / is common.
 */
export function sanitizeText(input: string): string {
  if (typeof input !== "string") return "";

  return input
    .replace(/<[^>]*>/g, "")     // strip HTML tags
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\0/g, "")
    .trim();
}
