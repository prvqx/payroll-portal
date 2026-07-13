// ============================================================================
// Supabase connection
// Fill these in with the values from your Supabase project:
// Project Settings → API → Project URL, and Project API keys → "anon public"
// ============================================================================
const SUPABASE_URL = "https://rrzwyozmasgvzpgxajfe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyend5b3ptYXNndnpwZ3hhamZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5Mzk5ODYsImV4cCI6MjA5OTUxNTk4Nn0.f1m4Ly8l44H1gI1hqB5RBcPGwQfRz4ZTtfux78P5seQ";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Turns "Jane A. Doe" into a stable, unique-ish internal login email.
// The person never sees this — they only ever type their name.
function nameToLoginEmail(fullName) {
  const slug = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${slug}@ymu.internal`;
}

function getFirstName(fullName) {
  return (fullName || "").trim().split(/\s+/)[0] || "there";
}
