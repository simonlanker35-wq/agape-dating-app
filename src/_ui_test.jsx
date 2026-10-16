// The whole app on top of the in-memory backend, signed in as a person who is here for both dating and friends
import { createRoot } from "react-dom/client";
import { createFakeBackend } from "./_sim/fakeSupabase";
import App from "./App.jsx";

const be = createFakeBackend();
be.install();
try { localStorage.removeItem("agape_mode"); Object.keys(localStorage).filter((k) => k.startsWith("agape_tour_")).forEach((k) => localStorage.removeItem(k)); } catch {}

const PHOTO = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#D9CDB8"/><circle cx="300" cy="300" r="120" fill="#B8912A"/><rect x="150" y="470" width="300" height="300" rx="140" fill="#B8912A"/></svg>');
const ids = [];
for (let i = 1; i <= 40; i++) {
  const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
  ids.push(id);
  be.seedProfile({
    id, email: `user${i}@sim.test`, name: ["Anna", "Ben", "Clara", "David", "Elena", "Felix", "Grace", "Hannes"][i % 8] + i, age: 22 + (i % 12), gender: i % 2 ? "male" : "female",
    denomination: ["Catholic", "Orthodox", "Protestant"][i % 3], job: "Teacher", school: "", location_city: "Schwyz", location_lat: 47.02 + (i % 5) * 0.01, location_lng: 8.65,
    photos: [PHOTO], prompts: [{ prompt: "My faith means to me", answer: "Everything" }, { prompt: "I go crazy for", answer: "hiking" }, { prompt: "Prayer", answer: "every morning" }],
    interests: ["Hiking", "Cooking"], details: { kids: "want", church: "weekly" }, filters: { minAge: 18, maxAge: 45, maxDistance: 80, denominations: [], details: {} },
    intent: i % 3 === 0 ? "friends" : i % 3 === 1 ? "both" : "date",
  });
}
// signed in as user 1 (male, here for both)
be.db.profiles.find((p) => p.id === ids[0]).intent = new URLSearchParams(location.search).get("intent") || "both";
if (new URLSearchParams(location.search).get("old")) be.db.profiles.find((p) => p.id === ids[0]).created_at = "2026-09-01T10:00:00.000Z";
be.setUser(ids[0]);
window.__BE = be;

createRoot(document.getElementById("root")).render(<App />);
