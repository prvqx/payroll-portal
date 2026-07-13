// ============================================================================
// Supabase connection
// Fill these in with the values from your Supabase project:
// Project Settings → API → Project URL, and Project API keys → "anon public"
// ============================================================================
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
