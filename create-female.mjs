import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ksscosugtbdzgekrszck.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_SERVICE_KEY env var");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function create() {
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: "sarah@test.com",
    password: "password123",
    email_confirm: true,
  });
  if (authErr) { console.error("Auth error:", authErr.message); process.exit(1); }

  const profile = {
    id: authUser.user.id,
    email: "sarah@test.com",
    name: "Sarah",
    age: 24,
    height: 168,
    gender: "female",
    denomination: "Catholic",
    job: "Teacher",
    school: "University of Zürich",
    location_city: "Schwyz",
    location_lat: 47.0207,
    location_lng: 8.6545,
    photos: [
      "https://i.pravatar.cc/800?u=sarah_test_a",
      "https://i.pravatar.cc/800?u=sarah_test_b",
      "https://i.pravatar.cc/800?u=sarah_test_c",
    ],
    prompts: [
      { prompt: "My faith means to me", answer: "Everything — it's the foundation of who I am" },
      { prompt: "Together, we could", answer: "Build a life full of adventure and purpose" },
      { prompt: "Typical Sunday", answer: "Church in the morning, brunch with friends, long walk" },
    ],
    interests: ["Hiking", "Worship Music", "Coffee", "Travel", "Photography", "Reading"],
    is_standout: false,
  };

  const { error: pErr } = await supabase.from("profiles").insert(profile);
  if (pErr) { console.error("Profile error:", pErr.message); process.exit(1); }

  console.log("Created female test account:");
  console.log("  Email: sarah@test.com");
  console.log("  Password: password123");
  console.log("  Location: Schwyz");
  console.log("  ID:", authUser.user.id);
}

create().catch((err) => { console.error(err); process.exit(1); });
