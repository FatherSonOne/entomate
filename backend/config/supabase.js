const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  console.warn('⚠️ SUPABASE_URL not set in environment');
}

if (!supabaseAnonKey) {
  console.warn('⚠️ SUPABASE_ANON_KEY not set in environment');
}

// Public client (uses Row Level Security)
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Admin client (bypasses Row Level Security - use carefully)
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

module.exports = { supabase, supabaseAdmin };
