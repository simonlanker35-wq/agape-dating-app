import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ksscosugtbdzgekrszck.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_SERVICE_KEY env var (from Supabase → Settings → API → service_role)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const denominations = [
  "Protestant", "Catholic", "Baptist", "Methodist", "Lutheran",
  "Pentecostal", "Non-denominational", "Orthodox", "Evangelical",
];

const interests = [
  "Hiking", "Worship Music", "Bible Study", "Travel", "Photography",
  "Cooking", "Reading", "Running", "Yoga", "Volunteering", "Music",
  "Coffee", "Art", "Swimming", "Cycling", "Dancing", "Surfing",
  "Gaming", "Prayer", "Podcasts", "Writing", "Community Service",
  "Gardening", "Dogs", "Cats",
];

const prompts = [
  { q: "My idea of a perfect Sunday", answers: ["Church in the morning, brunch with friends, and a long walk", "Sleeping in, then heading to a cozy café with my Bible", "Worship service, beach walk, cooking a big dinner"] },
  { q: "I'm looking for someone who", answers: ["Shares my faith and loves a good adventure", "Can make me laugh and isn't afraid to be vulnerable", "Loves Jesus and also loves tacos"] },
  { q: "A verse that guides me", answers: ["Love is patient, love is kind - 1 Cor 13:4", "For I know the plans I have for you - Jeremiah 29:11", "Be strong and courageous - Joshua 1:9"] },
  { q: "I could stay up all night talking about", answers: ["The best albums of all time, no skips", "Theology and why pineapple belongs on pizza", "Travel stories and bucket list adventures"] },
  { q: "I go crazy for", answers: ["Homemade pasta and a good sunset", "Live worship music and rainy days with coffee", "A perfectly planned road trip"] },
  { q: "Green flags I look for", answers: ["You have a genuine faith, not just Sunday mornings", "You remember the little things", "You can be silly and serious in the same conversation"] },
  { q: "A non-negotiable in my faith life", answers: ["Weekly worship — it recharges everything", "Praying together, not just alone", "Serving the community side by side"] },
];

const femaleNames = ["Sophia", "Lena", "Mia", "Emma", "Anna", "Laura", "Sarah", "Nina", "Lisa", "Julia", "Marie", "Lea", "Nora", "Clara", "Hannah", "Alina", "Amelie", "Chloe", "Elena", "Lara"];
const maleNames = ["Noah", "Liam", "Elias", "Ben", "Finn", "Jonas", "Leon", "Luca", "Paul", "David", "Felix", "Luis", "Tim", "Max", "Jan", "Tom", "Samuel", "Julian", "Rafael", "Lukas", "Simon"];
const cities = [
  { city: "Zürich", lat: 47.3769, lng: 8.5417 },
  { city: "Bern", lat: 46.9480, lng: 7.4474 },
  { city: "Basel", lat: 47.5596, lng: 7.5886 },
  { city: "Lucerne", lat: 47.0502, lng: 8.3093 },
  { city: "Geneva", lat: 46.2044, lng: 6.1432 },
  { city: "Lausanne", lat: 46.5197, lng: 6.6323 },
  { city: "St. Gallen", lat: 47.4245, lng: 9.3767 },
  { city: "Schwyz", lat: 47.0207, lng: 8.6545 },
];
const jobs = ["Teacher", "Nurse", "Engineer", "Designer", "Architect", "Musician", "Therapist", "Writer", "Developer", "Scientist", "Pastor", "Doctor", "Marketing", "Consultant", "Photographer"];
const schools = ["University of Zürich", "ETH Zürich", "University of Bern", "University of Basel", "EPFL", "University of Geneva", "HSG St. Gallen", "ZHAW", "FHNW"];

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function seed() {
  console.log("Clearing existing data...");
  await supabase.from("messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("likes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("skips").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("profiles").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // Delete all auth users
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  for (const u of existingUsers?.users || []) {
    await supabase.auth.admin.deleteUser(u.id);
  }
  console.log("Cleared");

  // Create test user
  const { data: testAuth, error: testErr } = await supabase.auth.admin.createUser({
    email: "simon2@test.com",
    password: "password123",
    email_confirm: true,
  });
  if (testErr) { console.error("Failed to create test user:", testErr); process.exit(1); }

  const testProfile = {
    id: testAuth.user.id,
    email: "simon2@test.com",
    name: "Simon",
    age: 25,
    height: 180,
    gender: "male",
    denomination: "Catholic",
    job: "Software Engineer",
    school: "ETH Zürich",
    location_city: "Schwyz",
    location_lat: 47.0207,
    location_lng: 8.6545,
    photos: ["/profile.jpg"],
    prompts: [
      { prompt: "My idea of a perfect Sunday", answer: "Church in the morning, brunch with friends, and a long walk" },
      { prompt: "I'm looking for someone who", answer: "Shares my faith and loves a good adventure" },
      { prompt: "A verse that guides me", answer: "Love is patient, love is kind - 1 Cor 13:4" },
    ],
    interests: ["Hiking", "Coffee", "Photography", "Travel"],
    is_standout: false,
  };

  await supabase.from("profiles").insert(testProfile);
  console.log("Created test user: simon2@test.com / password123");

  // Create demo profiles
  const profileIds = [];
  for (let i = 0; i < 40; i++) {
    const gender = i < 20 ? "female" : "male";
    const names = gender === "female" ? femaleNames : maleNames;
    const city = cities[i % cities.length];

    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: `demo${i}@agape.test`,
      password: "DemoPass123!",
      email_confirm: true,
    });
    if (authErr) { console.error(`Failed user ${i}:`, authErr.message); continue; }

    const userPrompts = pickN(prompts, 3).map((p) => ({
      prompt: p.q,
      answer: p.answers[Math.floor(Math.random() * p.answers.length)],
    }));

    const profile = {
      id: authUser.user.id,
      email: `demo${i}@agape.test`,
      name: names[i % names.length],
      age: 23 + Math.floor(Math.random() * 12),
      height: 155 + Math.floor(Math.random() * 30),
      gender,
      denomination: denominations[Math.floor(Math.random() * denominations.length)],
      job: jobs[Math.floor(Math.random() * jobs.length)],
      school: schools[Math.floor(Math.random() * schools.length)],
      location_city: city.city,
      location_lat: city.lat + (Math.random() - 0.5) * 0.5,
      location_lng: city.lng + (Math.random() - 0.5) * 0.5,
      photos: ["/profile.jpg"],
      prompts: userPrompts,
      interests: pickN(interests, 4 + Math.floor(Math.random() * 4)),
      is_standout: i < 20 && i % 4 === 0,
      compatibility_reason: i < 20 && i % 4 === 0 ? "Strong faith alignment and shared interests" : null,
      last_active: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
    };

    const { error: pErr } = await supabase.from("profiles").insert(profile);
    if (pErr) { console.error(`Profile ${i}:`, pErr.message); continue; }
    profileIds.push({ id: authUser.user.id, gender, name: names[i % names.length] });
  }
  console.log(`Seeded ${profileIds.length} demo profiles`);

  const females = profileIds.filter((p) => p.gender === "female");

  // Likes received (Sparks): 5 females liked Simon
  const likers = females.slice(0, 5);
  const likeComments = ["Love your Sunday vibes!", "That verse is my favourite too", null, "Fellow hiker here! Where's your go-to trail?", null];
  for (let i = 0; i < likers.length; i++) {
    await supabase.from("likes").insert({
      from_user: likers[i].id,
      to_user: testAuth.user.id,
      target_type: i < 2 ? "prompt" : "profile",
      target_index: i < 2 ? i : 0,
      comment: likeComments[i],
    });
  }
  console.log("Created 5 incoming likes (Sparks)");

  // Matches: mutual likes + messages with 3 females
  const matchers = females.slice(5, 8);
  const matchMessages = [
    ["Hey! I saw we both love hiking", "Yes! I go almost every weekend. Where's your favourite spot?", "Pilatus is incredible. Have you been?"],
    ["Would love to hear about your faith journey", "Amen to that! Which church do you go to?"],
    ["Your prompts made me smile", "That's so sweet, thank you!"],
  ];

  for (let i = 0; i < matchers.length; i++) {
    await supabase.from("likes").insert({ from_user: testAuth.user.id, to_user: matchers[i].id, target_type: "profile", target_index: 0 });
    await supabase.from("likes").insert({ from_user: matchers[i].id, to_user: testAuth.user.id, target_type: "profile", target_index: 0 });

    const { data: match } = await supabase.from("matches").insert({
      user1: testAuth.user.id,
      user2: matchers[i].id,
      last_activity: new Date(Date.now() - i * 3600000).toISOString(),
    }).select().single();

    const msgs = matchMessages[i];
    for (let j = 0; j < msgs.length; j++) {
      const sender = j % 2 === 0 ? matchers[i].id : testAuth.user.id;
      await supabase.from("messages").insert({
        match_id: match.id,
        sender,
        text: msgs[j],
        read: true,
        created_at: new Date(Date.now() - (msgs.length - j) * 60000 * 5 - i * 3600000).toISOString(),
      });
    }
  }
  console.log("Created 3 matches with messages");
  console.log("Done!");
}

seed().catch((err) => { console.error(err); process.exit(1); });
