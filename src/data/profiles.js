const PROMPT_CATEGORIES = {
  "Your World": [
    "In my friend group, I'm the one who",
    "I'm in my element when",
    "The kindest thing someone has ever done for me",
    "You'd never know it, but I",
    "An award my family would give me",
    "It's not a vacation unless",
    "I could stay up all night talking about",
    "Before we meet, you should listen to",
    "Where I go when I want to feel more like myself",
    "A life goal of mine",
    "My simple pleasures",
  ],
  "About Me": [
    "My most irrational fear",
    "Two truths and a lie",
    "I'm convinced that",
    "A shower thought I had recently",
    "I recently discovered that",
    "Dating me is like",
    "Typical Sunday",
    "I go crazy for",
    "What I order for the table",
  ],
  "My Type": [
    "I'm looking for",
    "Together, we could",
    "The hallmark of a good relationship is",
    "My love language is",
    "Green flags I look for",
    "The way to win me over is",
    "All I ask is that you",
  ],
  "Faith": [
    "My faith means to me",
    "A Bible verse I live by",
    "How I live out my faith",
    "My church community is",
    "I feel closest to God when",
  ],
};

const PROMPTS = Object.values(PROMPT_CATEGORIES).flat();

const FIRST_NAMES_F = [
  "Emma", "Sophia", "Olivia", "Ava", "Isabella", "Mia", "Charlotte",
  "Amelia", "Harper", "Evelyn", "Luna", "Chloe", "Ella", "Aria",
  "Scarlett", "Grace", "Lily", "Zoe", "Nora", "Riley",
  "Layla", "Stella", "Aurora", "Violet", "Hannah", "Maya",
  "Leah", "Naomi", "Alice", "Ellie",
];

const FIRST_NAMES_M = [
  "Liam", "Noah", "Oliver", "James", "Elijah", "William", "Henry",
  "Lucas", "Benjamin", "Jack", "Alexander", "Daniel", "Matthew",
  "Sebastian", "Owen", "Ethan", "Leo", "Aiden", "Nathan", "Ryan",
  "Caleb", "Max", "Julian", "Adrian", "Dylan", "Miles",
  "Kai", "Ezra", "Finn", "Oscar",
];

const JOBS = [
  "Product Designer", "Software Engineer", "Marketing Manager",
  "Photographer", "Teacher", "Nurse", "Architect", "Writer",
  "Data Scientist", "Chef", "Psychologist", "Lawyer",
  "Musician", "Graphic Designer", "Physical Therapist",
  "Entrepreneur", "Veterinarian", "Journalist", "Yoga Instructor",
  "Financial Analyst", "Interior Designer", "Biologist",
  "Art Director", "Pilot", "Social Worker",
];

const LOCATIONS = [
  "Zurich", "Basel", "Bern", "Lucerne", "Geneva",
  "Lausanne", "Winterthur", "St. Gallen", "Lugano", "Schwyz",
  "Munich", "Vienna", "Milan", "Lyon", "Stuttgart",
  "Freiburg", "Innsbruck",
];

const SCHOOLS = [
  "ETH Zurich", "University of Zurich", "EPFL", "University of Basel",
  "University of Bern", "University of Geneva", "HSG St. Gallen",
  "University of Lausanne", "ZHAW", "Lucerne University",
  "LMU Munich", "University of Vienna", "TU Munich",
  "Politecnico di Milano", "University of Freiburg", "Sciences Po",
];

const DENOMINATIONS = [
  "Catholic", "Protestant", "Evangelical", "Reformed",
  "Non-denominational", "Orthodox", "Baptist", "Pentecostal",
];

const PROMPT_ANSWERS = {
  "In my friend group, I'm the one who": [
    "Always plans the group trips and dinners",
    "Remembers everyone's birthday without Facebook",
    "Shows up with homemade food uninvited",
    "Gives the pep talks at 2am",
    "Has the best playlists for any mood",
  ],
  "I'm in my element when": [
    "I'm cooking dinner with music playing",
    "I'm hiking somewhere with an incredible view",
    "I'm deep in a conversation that matters",
    "I'm leading worship on a Sunday morning",
    "I'm exploring a new city with no itinerary",
  ],
  "The kindest thing someone has ever done for me": [
    "My small group showed up with meals for a month when I was sick",
    "A stranger paid for my coffee and left a note of encouragement",
    "My parents drove 6 hours to surprise me on a hard day",
    "A friend wrote me a letter listing everything they admired about me",
    "My mentor prayed with me every week for a year",
  ],
  "You'd never know it, but I": [
    "Can solve a Rubik's cube in under two minutes",
    "Used to be terrified of public speaking, now I love it",
    "Have read the entire Bible cover to cover three times",
    "Was a competitive swimmer for 10 years",
    "Speak three languages but only well in two",
  ],
  "An award my family would give me": [
    "Most likely to start a deep conversation at dinner",
    "Best at leaving dishes 'soaking' overnight",
    "Most dramatic reaction to good food",
    "Best gift giver in the family",
    "Most likely to cry at a movie",
  ],
  "It's not a vacation unless": [
    "I've found the best local coffee shop",
    "I've gotten lost at least once",
    "There's a body of water involved",
    "I come back needing a vacation from the vacation",
    "I've visited a local church",
  ],
  "I could stay up all night talking about": [
    "Theology, purpose, and what we're all doing here",
    "Travel stories and the places that changed us",
    "The best albums of all time, no skips",
    "Dreams, goals, and where we see ourselves in 10 years",
    "Whether a hot dog is a sandwich (it's not)",
  ],
  "Before we meet, you should listen to": [
    "Elevation Worship — so you know my vibe",
    "Any Bon Iver album to understand my soul",
    "The Daily podcast if you want to know what I'm into",
    "My Spotify playlist, it tells you everything",
    "Hillsong United — it'll set the tone",
  ],
  "Where I go when I want to feel more like myself": [
    "A quiet trail near the lake, just me and my thoughts",
    "My church's Tuesday night worship session",
    "A coffee shop with a good book and no agenda",
    "The mountains — something about the altitude resets me",
    "My parents' kitchen table",
  ],
  "A life goal of mine": [
    "To visit every continent before I'm 40",
    "Open a small cafe with a bookshop attached",
    "Learn to speak 4 languages fluently",
    "Run a marathon on every continent",
    "Write a novel that makes someone cry (happy tears)",
  ],
  "My simple pleasures": [
    "Fresh coffee, morning sun, and a good podcast",
    "A perfectly ripe avocado and sourdough toast",
    "Rain on the window while reading in bed",
    "Finding a new song that gives you chills",
    "The first bite of a warm chocolate chip cookie",
  ],
  "I'm looking for": [
    "Someone who makes ordinary moments feel special",
    "A partner in crime for weekend adventures",
    "Deep conversations and comfortable silences",
    "Someone who shares my values and faith",
    "A genuine connection rooted in something deeper",
  ],
  "Together, we could": [
    "Start a podcast nobody asked for",
    "Explore every farmers market in the city",
    "Have the best dinner party our friends have ever been to",
    "Serve together on a mission trip",
    "Build the world's most impressive blanket fort",
  ],
  "Typical Sunday": [
    "Church in the morning, brunch after, walk in nature",
    "Sleep in, morning worship, afternoon hike, evening cooking",
    "Morning service, coffee with the community, then rest",
    "Coffee shop, crossword puzzle, evening Bible study",
    "Church, farmers market, long lunch with friends",
  ],
  "My most irrational fear": [
    "That a fish will touch my foot in the ocean",
    "Butterflies. They're just pretty moths and I don't trust them",
    "Revolving doors. What if it doesn't stop?",
    "That someone is always watching through my laptop camera",
    "Walking over subway grates in heels",
  ],
  "I'm convinced that": [
    "Dogs can understand everything we say",
    "The best ideas come in the shower",
    "God has a sense of humour, just look at the platypus",
    "Pineapple on pizza is criminally underrated",
    "Everything happens for a reason, even the hard stuff",
  ],
  "My love language is": [
    "Quality time — put your phone down and be here with me",
    "Acts of service — I'll make your coffee exactly how you like it",
    "Words of affirmation, I will gas you up constantly",
    "Physical touch — I'm a professional cuddler",
    "Sending memes at 2am that made me think of you",
  ],
  "Green flags I look for": [
    "You're kind to strangers and tip well",
    "You have your own passions and friendships",
    "You can laugh at yourself",
    "You have a genuine faith, not just Sunday mornings",
    "You remember the small things I mention",
  ],
  "Dating me is like": [
    "Getting the aux cord — chaotic but entertaining",
    "Finding a $20 in your jacket pocket",
    "A crossword puzzle — challenging but rewarding",
    "A cozy rainy day — warm, comfortable, maybe some snacks",
    "A surprise road trip — spontaneous but always fun",
  ],
  "My faith means to me": [
    "Everything. It's the foundation I build my life on",
    "A constant source of peace, even when life gets chaotic",
    "Community, purpose, and the courage to love deeply",
    "The lens through which I see the world and treat people",
    "Not just belief — it's how I try to live every single day",
  ],
  "A Bible verse I live by": [
    "Love is patient, love is kind — 1 Corinthians 13:4",
    "For I know the plans I have for you — Jeremiah 29:11",
    "Be strong and courageous — Joshua 1:9",
    "Trust in the Lord with all your heart — Proverbs 3:5",
    "And now these three remain: faith, hope, and love — 1 Cor 13:13",
  ],
  "How I live out my faith": [
    "Through serving others and showing up for my community",
    "Daily prayer, weekly worship, and trying to love like Jesus",
    "By being intentional with how I treat people every day",
    "Volunteering at my church and mentoring younger believers",
    "Through gratitude — finding God in the small everyday moments",
  ],
  "My church community is": [
    "Like a second family — they've seen me at my best and worst",
    "Small but tight-knit, we actually do life together",
    "The reason I moved to this city honestly",
    "Full of people who challenge me to grow",
    "Where I found my closest friendships",
  ],
  "I feel closest to God when": [
    "I'm out in nature, surrounded by His creation",
    "Worshipping with others — there's something powerful about it",
    "I'm serving someone without expecting anything back",
    "Everything is quiet and I can just be still",
    "I'm reading Scripture and it speaks right to where I am",
  ],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomAge(min = 22, max = 35) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomHeight() {
  const cm = 158 + Math.floor(Math.random() * 32);
  return `${cm} cm`;
}

function generatePhotoUrl(seed, gender) {
  const g = gender === "female" ? "women" : "men";
  const id = (seed % 90) + 1;
  return `https://randomuser.me/api/portraits/${g}/${id}.jpg`;
}

function generatePromptAnswers() {
  const selectedPrompts = pickN(PROMPTS, 3);
  return selectedPrompts.map((prompt) => {
    const answers = PROMPT_ANSWERS[prompt];
    return {
      prompt,
      answer: answers ? pick(answers) : "Living my best life one day at a time",
    };
  });
}

const INTERESTS_POOL = [
  "Hiking", "Photography", "Cooking", "Travel", "Yoga",
  "Reading", "Music", "Art", "Dancing", "Surfing",
  "Skiing", "Running", "Wine Tasting", "Movies",
  "Board Games", "Meditation", "Cycling", "Gardening",
  "Volunteering", "Podcasts", "Camping", "Rock Climbing",
  "Bible Study", "Church", "Worship", "Prayer",
  "Community Service", "Mission Trips", "Coffee",
  "Dogs", "Cats", "Fitness", "Swimming",
];

export function generateProfiles(count = 40) {
  const profiles = [];
  for (let i = 0; i < count; i++) {
    const gender = Math.random() > 0.5 ? "female" : "male";
    const names = gender === "female" ? FIRST_NAMES_F : FIRST_NAMES_M;
    const name = pick(names);
    const age = randomAge();
    const photoCount = 3 + Math.floor(Math.random() * 4);
    const photos = Array.from({ length: photoCount }, (_, j) =>
      generatePhotoUrl(i * 7 + j * 13 + j, gender)
    );

    profiles.push({
      id: `profile_${i}`,
      name,
      age,
      gender,
      height: randomHeight(),
      job: pick(JOBS),
      school: pick(SCHOOLS),
      location: pick(LOCATIONS),
      denomination: pick(DENOMINATIONS),
      distance: 1 + Math.floor(Math.random() * 25),
      photos,
      prompts: generatePromptAnswers(),
      interests: pickN(INTERESTS_POOL, 4 + Math.floor(Math.random() * 4)),
      isStandout: Math.random() < 0.15,
      lastActive: Math.random() < 0.4 ? "Just now" : Math.random() < 0.7 ? "Today" : "Recently",
    });
  }
  return profiles;
}

export { PROMPTS, PROMPT_CATEGORIES, INTERESTS_POOL, DENOMINATIONS };
