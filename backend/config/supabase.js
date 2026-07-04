const { createClient } = require('@supabase/supabase-js');
const log = require('../utils/log');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  log.warn('SUPABASE_URL not set in environment');
}

if (!supabaseAnonKey) {
  log.warn('SUPABASE_ANON_KEY not set in environment');
}

if (!supabaseServiceKey) {
  log.warn('SUPABASE_SERVICE_KEY not set — backend will fall back to the anon client (RLS-enforced, no user context)');
}

// Anon client — RLS-enforced, but the backend attaches no end-user JWT, so
// auth.uid() is always NULL. Kept for any future per-request-JWT usage.
const supabaseAnon = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Default backend client. The backend is a trusted server-side tier that does
// its own auth (verifyAuth middleware) + app-layer org/owner filtering, so it
// runs on the service-role key (bypasses RLS). This lets RLS be ENABLED on the
// underlying tables as a perimeter against direct anon/PostgREST access without
// breaking backend reads. Falls back to the anon client only if no service key.
// (S1a — Data Foundation hardening, 2026-07-04.)
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabaseAnon;

// Admin client (explicit service-role handle; same privileges as `supabase`).
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

module.exports = { supabase, supabaseAdmin, supabaseAnon };
