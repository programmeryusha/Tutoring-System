import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client with service_role privileges.
 * Use ONLY in API routes (never expose to the browser).
 * Bypasses RLS — can create users, manage all data.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : (null as unknown as ReturnType<typeof createClient>);
