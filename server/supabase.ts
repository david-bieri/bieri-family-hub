import { createClient } from "@supabase/supabase-js";

// Accept both VITE_-prefixed (Render dashboard) and plain names
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.warn("[supabase] Missing SUPABASE_URL / VITE_SUPABASE_URL — using SQLite fallback");
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export default supabase;
