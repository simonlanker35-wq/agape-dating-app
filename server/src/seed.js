import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import config from "./config.js";
import User from "./models/User.js";
import Like from "./models/Like.js";
import Skip from "./models/Skip.js";
import Match from "./models/Match.js";
import Message from "./models/Message.js";

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
  { q: "My idea of a perfect Sunday", answers: [
    "Church in the morning, brunch with friends, and a long walk",
    "Sleeping in, then heading to a cozy café with my Bible",
    "Worship service, beach walk, cooking a big dinner",
  ]},
  { q: "I'm looking for someone who", answers: [
    "Shares my faith and loves a good adventure",
    "Can make me laugh and isn't afraid to be vulnerable",
    "Loves Jesus and also loves tacos",
  ]},
  { q: "A verse that guides me", answers: [
    "Love is patient, love is kind - 1 Cor 13:4",
    "For I know the plans I have for you - Jeremiah 29:11",
    "Be strong and courageous - Joshua 1:9",
  ]},
  { q: "I could stay up all night talking about", answers: [
    "The best albums of all time, no skips",
    "Theology and why pineapple belongs on pizza",
    "Travel stories and bucket list adventures",
  ]},
  { q: "I go crazy for", answers: [
    "Homemade pasta and a good sunset",
    "Live worship music and rainy days with coffee",
    "A perfectly planned road trip",
  ]},
  { q: "Green flags I look for", answers: [
    "You have a genuine faith, not just Sunday mornings",
    "You remember the little things",
    "You can sit in comfortable silence together",
  ]},
  { q: "A non-negotiable in my faith life", answers: [
    "Accountability with my brothers. Iron sharpens iron.",
    "Weekly worship — it recharges everything",
    "Daily prayer, no matter how short",
  ]},
  { q: "I feel closest to God when", answers: [
    "Worshipping through music — I play guitar at my church",
    "I'm singing worship alone in my car — unfiltered and honest",
    "Hiking in nature, surrounded by His creation",
  ]},
];

const cities = [
  { city: "Zürich", coords: [8.5417, 47.3769] },
  { city: "Basel", coords: [7.5886, 47.5596] },
  { city: "Bern", coords: [7.4474, 46.9480] },
  { city: "Luzern", coords: [8.3093, 47.0502] },
  { city: "Schwyz", coords: [8.6545, 47.0207] },
  { city: "St. Gallen", coords: [9.3767, 47.4245] },
  { city: "Innsbruck", coords: [11.3928, 47.2692] },
  { city: "München", coords: [11.5820, 48.1351] },
  { city: "Freiburg", coords: [7.8421, 47.9990] },
  { city: "Konstanz", coords: [9.1759, 47.6603] },
];

const femaleNames = [
  "Sophia", "Lena", "Mia", "Emma", "Anna", "Laura", "Sarah",
  "Nina", "Elena", "Julia", "Lea", "Nora", "Chloe", "Alina",
  "Hanna", "Marie", "Lia", "Amelie", "Ella", "Fiona",
];

const maleNames = [
  "Noah", "Liam", "Elias", "Leon", "Ben", "Lukas", "Jonas",
  "David", "Samuel", "Tim", "Jan", "Max", "Felix", "Julian",
  "Nico", "Daniel", "Paul", "Finn", "Tom", "Marco",
];

const jobs = [
  "Teacher", "Nurse", "Software Engineer", "Marketing Manager",
  "Graphic Designer", "Student", "Physical Therapist", "Architect",
  "Social Worker", "Music Teacher", "Barista", "Photographer",
  "Data Analyst", "Youth Pastor", "Doctor",
];

const schools = [
  "ETH Zürich", "University of Zürich", "University of Basel",
  "University of Bern", "ZHAW", "FHNW", "University of Freiburg",
  "University of St. Gallen", "HSLU", "University of Innsbruck",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function seed() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");

  await Message.deleteMany({});
  await Match.deleteMany({});
  await Like.deleteMany({});
  await Skip.deleteMany({});
  await User.deleteMany({});
  console.log("Cleared existing data");

  const hashedPassword = await bcrypt.hash("DemoPass123!", 12);
  const users = [];

  for (let i = 0; i < 40; i++) {
    const gender = i < 20 ? "female" : "male";
    const names = gender === "female" ? femaleNames : maleNames;
    const name = names[i % names.length];
    const age = 22 + Math.floor(Math.random() * 12);
    const city = pick(cities);

    const userPrompts = pickN(prompts, 3).map((p, idx) => {
      const base = { prompt: p.q, answer: pick(p.answers) };
      if (i % 3 === 0 && idx === 2) {
        base.voice = { duration: `0:${18 + Math.floor(Math.random() * 25)}` };
      }
      return base;
    });

    users.push({
      email: `${name.toLowerCase()}${i}@agape-demo.test`,
      password: hashedPassword,
      name,
      age,
      height: 155 + Math.floor(Math.random() * 35),
      gender,
      denomination: pick(denominations),
      job: pick(jobs),
      school: pick(schools),
      location: {
        type: "Point",
        coordinates: [
          city.coords[0] + (Math.random() - 0.5) * 0.5,
          city.coords[1] + (Math.random() - 0.5) * 0.5,
        ],
        city: city.city,
      },
      photos: ["/profile.jpg"],
      prompts: userPrompts,
      interests: pickN(interests, 4 + Math.floor(Math.random() * 4)),
      lastActive: new Date(Date.now() - Math.random() * 86400000 * 3),
    });
  }

  const testUser = {
    email: "simon2@test.com",
    password: await bcrypt.hash("password123", 12),
    name: "Simon",
    age: 25,
    height: 180,
    gender: "male",
    denomination: "Catholic",
    job: "Software Engineer",
    school: "ETH Zürich",
    location: {
      type: "Point",
      coordinates: [8.6545, 47.0207],
      city: "Schwyz",
    },
    photos: ["/profile.jpg"],
    prompts: [
      { prompt: "My idea of a perfect Sunday", answer: "Church in the morning, brunch with friends, and a long walk" },
      { prompt: "I'm looking for someone who", answer: "Shares my faith and loves a good adventure" },
      { prompt: "A verse that guides me", answer: "Love is patient, love is kind - 1 Cor 13:4" },
    ],
    interests: ["Hiking", "Coffee", "Photography", "Travel"],
    lastActive: new Date(),
  };
  users.push(testUser);

  const inserted = await User.insertMany(users);
  console.log(`Seeded ${inserted.length} profiles`);

  const simon = inserted[inserted.length - 1];
  const females = inserted.filter((u) => u.gender === "female");

  // --- Likes received (Sparks tab): 5 females liked Simon ---
  const likers = females.slice(0, 5);
  const likeComments = [
    "Love your Sunday vibes!",
    "That verse is my favourite too 🙏",
    null,
    "Fellow hiker here! Where's your go-to trail?",
    null,
  ];
  for (let i = 0; i < likers.length; i++) {
    await Like.create({
      from: likers[i]._id,
      to: simon._id,
      targetType: i < 2 ? "prompt" : "profile",
      targetIndex: i < 2 ? i : 0,
      comment: likeComments[i],
    });
  }
  console.log(`Created ${likers.length} incoming likes (Sparks)`);

  // --- Matches (Messages tab): mutual likes with 3 females ---
  const matchers = females.slice(5, 8);
  const matchMessages = [
    ["Hey! I saw we both love hiking 🏔️", "Yes! I go almost every weekend. Where's your favourite spot?", "Pilatus is incredible. Have you been?"],
    ["Would love to hear about your faith journey ✝️", "Amen to that! Which church do you go to?"],
    ["Your prompts made me smile 😊", "That's so sweet, thank you!"],
  ];

  for (let i = 0; i < matchers.length; i++) {
    await Like.create({ from: simon._id, to: matchers[i]._id, targetType: "profile", targetIndex: 0 });
    await Like.create({ from: matchers[i]._id, to: simon._id, targetType: "profile", targetIndex: 0 });

    const match = await Match.create({
      users: [simon._id, matchers[i]._id],
      lastActivity: new Date(Date.now() - i * 3600000),
    });

    const msgs = matchMessages[i];
    for (let j = 0; j < msgs.length; j++) {
      const sender = j % 2 === 0 ? matchers[i]._id : simon._id;
      const msg = await Message.create({
        match: match._id,
        sender,
        text: msgs[j],
        read: true,
        createdAt: new Date(Date.now() - (msgs.length - j) * 60000 * 5 - i * 3600000),
      });
      match.lastMessage = msg._id;
    }
    await match.save();
  }
  console.log(`Created ${matchers.length} matches with messages`);

  await mongoose.disconnect();
  console.log("Done");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
