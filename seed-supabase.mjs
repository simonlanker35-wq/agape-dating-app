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

const promptCategories = {
  Faith: [
    { q: "My faith means to me", answers: ["Everything — it's the foundation of who I am", "A compass that guides every decision I make", "The reason I have hope even on the hard days"] },
    { q: "A Bible verse I live by", answers: ["Love is patient, love is kind - 1 Cor 13:4", "For I know the plans I have for you - Jeremiah 29:11", "Be strong and courageous - Joshua 1:9"] },
    { q: "How I live out my faith", answers: ["Through serving others and staying in community", "Daily prayer and trying to love like Jesus did", "Small acts of kindness every single day"] },
    { q: "I feel closest to God when", answers: ["I'm in nature, surrounded by His creation", "I'm worshipping with my church family", "I'm praying quietly in the early morning"] },
    { q: "What worship looks like for me", answers: ["Singing loudly, hands up, full heart", "Quiet reflection with a candle and my Bible", "Being in community and serving together"] },
    { q: "How my faith shapes my relationships", answers: ["It teaches me patience, grace, and forgiveness", "I lead with love and seek someone who does the same", "It's the foundation — everything else is built on it"] },
  ],
  Future: [
    { q: "In 5 years I see myself", answers: ["Married, travelling, and deeply rooted in community", "Building a home full of love, laughter, and faith", "Growing in my career while serving my church"] },
    { q: "A life goal of mine", answers: ["Start a family rooted in faith and adventure", "Visit every continent and serve in each one", "Build something that outlasts me"] },
    { q: "The kind of family I dream of", answers: ["Loud dinners, Sunday church, lots of love", "One where faith and fun go hand in hand", "A home that's always open to others"] },
    { q: "Together, we could", answers: ["Build a life full of adventure and purpose", "Travel the world and grow closer to God", "Start traditions that last generations"] },
    { q: "The adventure I want to go on next", answers: ["Backpacking through the Swiss Alps", "A road trip with no set destination", "A mission trip to somewhere I've never been"] },
    { q: "The legacy I want to leave", answers: ["That I loved well and lived with purpose", "A family that knows God and serves others", "Kindness wherever I went"] },
  ],
  "About Me": [
    { q: "In my friend group, I'm the one who", answers: ["Plans everything and shows up early", "Makes everyone laugh at the worst times", "Remembers everyone's birthday and sends voice notes"] },
    { q: "I'm in my element when", answers: ["I'm hiking with a podcast and a coffee", "I'm cooking for people I love", "I'm exploring a new city with no plan"] },
    { q: "Dating me is like", answers: ["A cozy Sunday with a surprise adventure thrown in", "Finding someone who actually listens and remembers", "Good coffee, deep talks, and a lot of laughter"] },
    { q: "Typical Sunday", answers: ["Church in the morning, brunch with friends, long walk", "Sleeping in, cozy café, open Bible", "Worship, beach walk, cooking a big dinner"] },
    { q: "I go crazy for", answers: ["Homemade pasta and a good sunset", "Live worship music and rainy days with coffee", "A perfectly planned road trip"] },
    { q: "I could stay up all night talking about", answers: ["The best albums of all time, no skips", "Theology and why pineapple belongs on pizza", "Travel stories and bucket list adventures"] },
  ],
};
const allPrompts = Object.values(promptCategories).flat();

const femaleNames = ["Sophia", "Lena", "Mia", "Emma", "Anna", "Laura", "Sarah", "Nina", "Lisa", "Julia", "Marie", "Lea", "Nora", "Clara", "Hannah", "Alina", "Amelie", "Chloe", "Elena", "Lara"];
const maleNames = ["Noah", "Liam", "Elias", "Ben", "Finn", "Jonas", "Leon", "Luca", "Paul", "David", "Felix", "Luis", "Tim", "Max", "Jan", "Tom", "Samuel", "Julian", "Rafael", "Lukas", "Simon"];

const bgFemaleNames = ["Viktoria", "Maria", "Gabriela", "Desislava", "Ivana", "Kalina", "Rada", "Tsvetana", "Yana", "Anelia", "Bilyana", "Darina", "Elitsa"];
const bgMaleNames = ["Dimitar", "Georgi", "Nikolay", "Stefan", "Aleksandar", "Todor", "Krasimir", "Petar", "Yordan", "Boyan", "Hristo", "Veselin"];
const bgCities = [
  { city: "Sofia", lat: 42.6977, lng: 23.3219 },
  { city: "Sofia", lat: 42.6977, lng: 23.3219 },
  { city: "Plovdiv", lat: 42.1354, lng: 24.7453 },
  { city: "Plovdiv", lat: 42.1354, lng: 24.7453 },
  { city: "Varna", lat: 43.2141, lng: 27.9147 },
  { city: "Burgas", lat: 42.5048, lng: 27.4626 },
  { city: "Stara Zagora", lat: 42.4258, lng: 25.6345 },
  { city: "Blagoevgrad", lat: 42.0116, lng: 23.0979 },
  { city: "Veliko Tarnovo", lat: 43.0757, lng: 25.6172 },
  { city: "Ruse", lat: 43.8486, lng: 25.9549 },
];
const bgSchools = ["Sofia University", "UNWE Sofia", "New Bulgarian University", "Plovdiv University", "Technical University Sofia", "American University in Bulgaria"];
const cities = [
  { city: "Schwyz", lat: 47.0207, lng: 8.6545 },
  { city: "Schwyz", lat: 47.0207, lng: 8.6545 },
  { city: "Lucerne", lat: 47.0502, lng: 8.3093 },
  { city: "Lucerne", lat: 47.0502, lng: 8.3093 },
  { city: "Zürich", lat: 47.3769, lng: 8.5417 },
  { city: "Zürich", lat: 47.3769, lng: 8.5417 },
  { city: "Zug", lat: 47.1724, lng: 8.5174 },
  { city: "St. Gallen", lat: 47.4245, lng: 9.3767 },
  { city: "Bern", lat: 46.9480, lng: 7.4474 },
  { city: "Basel", lat: 47.5596, lng: 7.5886 },
];
const jobs = ["Teacher", "Nurse", "Engineer", "Designer", "Architect", "Musician", "Therapist", "Writer", "Developer", "Scientist", "Pastor", "Doctor", "Marketing", "Consultant", "Photographer"];
const schools = ["University of Zürich", "ETH Zürich", "University of Bern", "University of Basel", "EPFL", "University of Geneva", "HSG St. Gallen", "ZHAW", "FHNW"];

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function seed() {
  console.log("Clearing existing data...");
  await supabase.from("date_invitations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("likes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("skips").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("profiles").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // Delete all auth users (paginate to get them all)
  let page = 1;
  let deleted = 0;
  while (true) {
    const { data: existingUsers } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    const users = existingUsers?.users || [];
    if (users.length === 0) break;
    for (const u of users) {
      await supabase.auth.admin.deleteUser(u.id);
      deleted++;
    }
    page++;
  }
  console.log(`Deleted ${deleted} auth users`);
  console.log("Cleared");

  // Create test user (male)
  const { data: testAuth, error: testErr } = await supabase.auth.admin.createUser({
    email: "simon2@test.com",
    password: "password123",
    email_confirm: true,
  });
  if (testErr) { console.error("Failed to create test user:", testErr); process.exit(1); }

  // Create female test user
  const { data: sarahAuth, error: sarahErr } = await supabase.auth.admin.createUser({
    email: "sarah@test.com",
    password: "password123",
    email_confirm: true,
  });
  if (sarahErr) { console.error("Failed to create sarah test user:", sarahErr); }

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
    photos: [],
    prompts: [
      { prompt: "A Bible verse I live by", answer: "Love is patient, love is kind - 1 Cor 13:4" },
      { prompt: "In 5 years I see myself", answer: "Married, travelling, and deeply rooted in community" },
      { prompt: "Typical Sunday", answer: "Church in the morning, brunch with friends, then a long walk by the lake" },
    ],
    interests: ["Hiking", "Coffee", "Photography", "Travel"],
    is_standout: false,
  };

  await supabase.from("profiles").insert(testProfile);
  console.log("Created test user: simon2@test.com / password123");

  // Sarah profile
  if (sarahAuth) {
    const sarahProfile = {
      id: sarahAuth.user.id,
      email: "sarah@test.com",
      name: "Sarah",
      age: 24,
      height: 168,
      gender: "female",
      denomination: "Catholic",
      job: "Nurse",
      school: "University of Zürich",
      location_city: "Schwyz",
      location_lat: 47.0207,
      location_lng: 8.6545,
      photos: [],
      prompts: [
        { prompt: "My faith means to me", answer: "Everything — it's the foundation of who I am" },
        { prompt: "Typical Sunday", answer: "Church in the morning, brunch with friends, long walk" },
        { prompt: "Dating me is like", answer: "A cozy Sunday with a surprise adventure thrown in" },
      ],
      interests: ["Hiking", "Coffee", "Worship Music", "Cooking", "Travel"],
      is_standout: false,
    };
    await supabase.from("profiles").insert(sarahProfile);
    console.log("Created test user: sarah@test.com / password123");
  }

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

    const userPrompts = Object.values(promptCategories).map((catPrompts) => {
      const p = catPrompts[Math.floor(Math.random() * catPrompts.length)];
      return { prompt: p.q, answer: p.answers[Math.floor(Math.random() * p.answers.length)] };
    });

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
      location_lat: city.lat + (Math.random() - 0.5) * 0.15,
      location_lng: city.lng + (Math.random() - 0.5) * 0.15,
      photos: [],
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
  console.log(`Seeded ${profileIds.length} Swiss demo profiles`);

  // --- Bulgarian test user ---
  const { data: bgTestAuth, error: bgTestErr } = await supabase.auth.admin.createUser({
    email: "bg@test.com",
    password: "password123",
    email_confirm: true,
  });
  if (bgTestErr) { console.error("Failed to create BG test user:", bgTestErr); }
  else {
    const bgTestProfile = {
      id: bgTestAuth.user.id,
      email: "bg@test.com",
      name: "Nikolay",
      age: 26,
      height: 182,
      gender: "male",
      denomination: "Orthodox",
      job: "Developer",
      school: "Sofia University",
      location_city: "Sofia",
      location_lat: 42.6977,
      location_lng: 23.3219,
      photos: [],
      prompts: [
        { prompt: "I feel closest to God when", answer: "I'm at liturgy in Alexander Nevsky, surrounded by icons and incense" },
        { prompt: "Together, we could", answer: "Explore the mountains, share banitsa, and grow in faith together" },
        { prompt: "Typical Sunday", answer: "Liturgy at Alexander Nevsky, then a walk through Borisova Gradina" },
      ],
      interests: ["Hiking", "Coffee", "Travel", "Photography"],
      is_standout: false,
    };
    await supabase.from("profiles").insert(bgTestProfile);
    console.log("Created BG test user: bg@test.com / password123");
  }

  // --- 25 Bulgarian demo profiles ---
  const bgProfileIds = [];
  for (let i = 0; i < 25; i++) {
    const gender = i < 13 ? "female" : "male";
    const names = gender === "female" ? bgFemaleNames : bgMaleNames;
    const city = bgCities[i % bgCities.length];

    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: `bg_demo${i}@agape.test`,
      password: "DemoPass123!",
      email_confirm: true,
    });
    if (authErr) { console.error(`Failed BG user ${i}:`, authErr.message); continue; }

    const userPrompts = Object.values(promptCategories).map((catPrompts) => {
      const p = catPrompts[Math.floor(Math.random() * catPrompts.length)];
      return { prompt: p.q, answer: p.answers[Math.floor(Math.random() * p.answers.length)] };
    });

    const profile = {
      id: authUser.user.id,
      email: `bg_demo${i}@agape.test`,
      name: names[i % names.length],
      age: 22 + Math.floor(Math.random() * 12),
      height: 155 + Math.floor(Math.random() * 30),
      gender,
      denomination: ["Orthodox", "Orthodox", "Orthodox", "Protestant", "Evangelical", "Baptist", "Pentecostal", "Non-denominational", "Catholic"][Math.floor(Math.random() * 9)],
      job: jobs[Math.floor(Math.random() * jobs.length)],
      school: bgSchools[Math.floor(Math.random() * bgSchools.length)],
      location_city: city.city,
      location_lat: city.lat + (Math.random() - 0.5) * 0.15,
      location_lng: city.lng + (Math.random() - 0.5) * 0.15,
      photos: [],
      prompts: userPrompts,
      interests: pickN(interests, 4 + Math.floor(Math.random() * 4)),
      is_standout: i < 13 && i % 4 === 0,
      compatibility_reason: i < 13 && i % 4 === 0 ? "Strong faith alignment and shared interests" : null,
      last_active: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
    };

    const { error: pErr } = await supabase.from("profiles").insert(profile);
    if (pErr) { console.error(`BG Profile ${i}:`, pErr.message); continue; }
    bgProfileIds.push({ id: authUser.user.id, gender, name: names[i % names.length] });
  }
  console.log(`Seeded ${bgProfileIds.length} Bulgarian demo profiles`);

  const females = profileIds.filter((p) => p.gender === "female");
  const males = profileIds.filter((p) => p.gender === "male");

  // Likes received (Sparks): 8 females liked Simon — all with comments, 1 dove
  const simonLikers = females.slice(0, 8);
  const simonLikeComments = [
    "Love your Sunday vibes! Church + brunch is the dream 🙌",
    "That verse is my favourite too — it got me through hard seasons",
    "Fellow hiker here! Where's your go-to trail?",
    "Your photos are beautiful! Where was the third one taken?",
    "I love that you value community. That's so rare these days",
    "ETH Zürich? Impressive! What did you study?",
    "Your faith journey sounds beautiful — I'd love to hear more",
    "We share so many interests! Coffee + hiking = perfect combo",
  ];
  const simonLikeDove = [false, true, false, false, false, false, false, false];
  for (let i = 0; i < simonLikers.length; i++) {
    await supabase.from("likes").insert({
      from_user: simonLikers[i].id,
      to_user: testAuth.user.id,
      target_type: i < 3 ? "prompt" : "profile",
      target_index: i < 3 ? i % 3 : 0,
      comment: simonLikeComments[i],
      is_dove: simonLikeDove[i],
    });
  }
  console.log("Created 8 incoming likes (Sparks) for Simon — all with comments, 1 dove");

  // Likes received (Sparks) for Sarah: 6 males liked Sarah — all with comments
  if (sarahAuth) {
    const sarahLikers = males.slice(0, 6);
    const sarahLikeComments = [
      "Love your faith journey! What church do you attend?",
      "That Sunday routine sounds perfect — I do the same thing!",
      "Would love to grab coffee sometime ☕",
      "Your prompts are so genuine, refreshing to see",
      "Fellow nurse? My sister is one too — so much respect 🙏",
      "Your hiking photos are amazing! Have you done Pilatus?",
    ];
    for (let i = 0; i < sarahLikers.length; i++) {
      await supabase.from("likes").insert({
        from_user: sarahLikers[i].id,
        to_user: sarahAuth.user.id,
        target_type: i < 2 ? "prompt" : "profile",
        target_index: i < 2 ? i : 0,
        comment: sarahLikeComments[i],
      });
    }
    console.log("Created 6 incoming likes (Sparks) for Sarah — all with comments");
  }

  // Matches: mutual likes + messages with 3 females
  const matchers = females.slice(6, 9);
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
