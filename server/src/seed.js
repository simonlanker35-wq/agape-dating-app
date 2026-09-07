import mongoose from "mongoose";
import config from "./config.js";
import User from "./models/User.js";

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

  await User.deleteMany({});
  console.log("Cleared existing users");

  const users = [];

  for (let i = 0; i < 40; i++) {
    const gender = i < 20 ? "female" : "male";
    const names = gender === "female" ? femaleNames : maleNames;
    const name = names[i % names.length];
    const age = 22 + Math.floor(Math.random() * 12);
    const city = pick(cities);
    const g = gender === "female" ? "women" : "men";
    const photoId = 10 + i * 3;

    const userPrompts = pickN(prompts, 3).map((p) => ({
      prompt: p.q,
      answer: pick(p.answers),
    }));

    users.push({
      email: `${name.toLowerCase()}${i}@agape-demo.test`,
      password: "DemoPass123!",
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
      photos: [
        `https://randomuser.me/api/portraits/${g}/${photoId % 100}.jpg`,
        `https://randomuser.me/api/portraits/${g}/${(photoId + 1) % 100}.jpg`,
        `https://randomuser.me/api/portraits/${g}/${(photoId + 2) % 100}.jpg`,
      ],
      prompts: userPrompts,
      interests: pickN(interests, 4 + Math.floor(Math.random() * 4)),
      lastActive: new Date(Date.now() - Math.random() * 86400000 * 3),
    });
  }

  await User.insertMany(users);
  console.log(`Seeded ${users.length} profiles`);

  await mongoose.disconnect();
  console.log("Done");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
