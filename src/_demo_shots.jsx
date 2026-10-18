// The whole app on top of the in-memory backend, signed in as a person who is here for both dating and friends
import { createRoot } from "react-dom/client";
import { createFakeBackend } from "./_sim/fakeSupabase";
import App from "./App.jsx";

const be = createFakeBackend();
be.install();
try { localStorage.removeItem("agape_mode"); Object.keys(localStorage).filter((k) => k.startsWith("agape_tour_")).forEach((k) => localStorage.removeItem(k)); } catch {}

const PHOTO = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#D9CDB8"/><circle cx="300" cy="300" r="120" fill="#B8912A"/><rect x="150" y="470" width="300" height="300" rx="140" fill="#B8912A"/></svg>');
const ids = [];
// DEMO DATA FOR WEBSITE SCREENSHOTS (temporary file, not part of the app)
const COV = { lat: 52.4068, lng: -1.5197 };
const WOMEN = ["Hannah", "Esther", "Ruth", "Naomi", "Lydia", "Miriam", "Abigail", "Rebecca", "Sarah", "Leah"];
const MEN = ["Simon", "Daniel", "James", "Samuel", "Joshua", "Matthew", "Peter", "Luke", "John", "Thomas"];
const base = { churchAttendance: "Every week", prayer: "Daily", wantsChildren: "Yes", lookingFor: "Marriage", relocate: "Open to it", smoking: "Non-smoker", drinking: "Socially", exercise: "Almost daily" };
for (let i = 1; i <= 20; i++) {
  const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
  ids.push(id);
  const female = i % 2 === 0;
  be.seedProfile({
    id, email: `user${i}@sim.test`, name: female ? WOMEN[(i / 2 - 1) % 10] : MEN[((i - 1) / 2) % 10], age: 24 + (i % 9), gender: female ? "female" : "male",
    denomination: ["Protestant", "Evangelical", "Catholic"][i % 3], job: "Teacher", school: "", location_city: "Coventry",
    location_lat: COV.lat + ((i % 7) - 3) * 0.008, location_lng: COV.lng + ((i % 5) - 2) * 0.01,
    photos: [PHOTO], prompts: [{ prompt: "My faith means to me", answer: "Knowing I am loved before I do anything right." }, { prompt: "A perfect Sunday", answer: "Morning service, long lunch with friends, a walk by the canal." }, { prompt: "I go crazy for", answer: "Homemade bread and old hymns." }],
    interests: ["Hiking", "Worship music", "Reading", "Baking"], details: { ...base, prayer: "A few times a week", drinking: "On special occasions", exercise: "Daily" },
    filters: { minAge: 18, maxAge: 45, maxDistance: 80, denominations: [], details: {} }, intent: "date",
    verified_photos: { church: "yes" }, job: "Primary school teacher",
  });
}
// the viewer: Simon, Coventry
Object.assign(be.db.profiles.find((p) => p.id === ids[0]), { name: "Simon", age: 28, denomination: "Protestant", interests: ["Hiking", "Cooking", "Worship music", "Coffee"], details: base, location_lat: COV.lat, location_lng: COV.lng });
// the first woman becomes "Hannah, 27"
Object.assign(be.db.profiles.find((p) => p.id === ids[1]), { name: "Hannah", age: 27, denomination: "Protestant" });
// signed in as user 1 (male, here for both)
be.db.profiles.find((p) => p.id === ids[0]).intent = new URLSearchParams(location.search).get("intent") || "both";
if (new URLSearchParams(location.search).get("old")) be.db.profiles.find((p) => p.id === ids[0]).created_at = "2026-09-01T10:00:00.000Z";
be.db.community_posts.push(
  { id: "11111111-1111-4111-8111-111111111111", author: ids[2], category: "prayer", title: "Prayers for my grandmother", body: "She is in hospital this week. Would be grateful for your prayers.", reply_count: 1, amen_count: 3, created_at: new Date(Date.now() - 3600e3).toISOString(), last_activity: new Date(Date.now() - 600e3).toISOString() },
  { id: "22222222-2222-4222-8222-222222222222", author: ids[4], category: "meetups", title: "Hike + picnic Sunday after mass?", body: "Thinking Mythen, easy pace, bring something to share. Who is in?", reply_count: 0, amen_count: 1, created_at: new Date(Date.now() - 7200e3).toISOString(), last_activity: new Date(Date.now() - 7200e3).toISOString() },
);
be.db.community_replies.push({ id: "33333333-3333-4333-8333-333333333333", post_id: "11111111-1111-4111-8111-111111111111", author: ids[6], body: "Praying for her tonight. 🙏", created_at: new Date(Date.now() - 600e3).toISOString() });
if (new URLSearchParams(location.search).get("premium")) be.db.profiles.find((p) => p.id === ids[0]).subscription_status = "active";
be.db.profiles.find((p) => p.id === ids[0]).email = "simon@example.com";
be.setUser(ids[0]);
window.__BE = be;

createRoot(document.getElementById("root")).render(<App />);

