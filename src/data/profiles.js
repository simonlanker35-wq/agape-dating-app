const PROMPT_CATEGORIES = {
  "Faith": [
    "My faith means to me",
    "A Bible verse I live by",
    "How I live out my faith",
    "My church community is",
    "I feel closest to God when",
    "A prayer that changed my life",
    "What worship looks like for me",
    "How my faith shapes my relationships",
    "A moment God felt real to me",
    "What I'd want my partner to know about my faith",
  ],
  "Future": [
    "In 5 years I see myself",
    "A life goal of mine",
    "The kind of family I dream of",
    "Where I want to settle down",
    "Together, we could",
    "My biggest dream right now",
    "What I'm building towards",
    "The adventure I want to go on next",
    "A cause I want to give my life to",
    "The legacy I want to leave",
  ],
  "About Me": [
    "In my friend group, I'm the one who",
    "I'm in my element when",
    "You'd never know it, but I",
    "Dating me is like",
    "Typical Sunday",
    "I go crazy for",
    "My simple pleasures",
    "I could stay up all night talking about",
    "My most irrational fear",
    "Two truths and a lie",
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
  "Catholic", "Orthodox", "Reformed", "Protestant", "Evangelical",
  "Non-denominational", "Baptist", "Pentecostal", "Different",
];

const TRAITS_POOL = [
  "Sport", "Praying", "Worship Music", "Bible Study", "Volunteering",
  "Mission Trips", "Cooking", "Hiking", "Travel", "Photography",
  "Reading", "Coffee", "Dogs", "Cats", "Fitness",
  "Running", "Swimming", "Cycling", "Yoga", "Dancing",
  "Art", "Music", "Gardening", "Camping", "Board Games",
  "Podcasts", "Writing", "Rock Climbing", "Skiing", "Surfing",
];

const INTERESTS_POOL = TRAITS_POOL;

const PROMPT_ANSWERS = {
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
  "A prayer that changed my life": [
    "Lord, not my will but yours — and meaning it for the first time",
    "A desperate 3am prayer that was answered in the most unexpected way",
    "Praying for patience and getting the chance to practise it immediately",
    "Asking God to show me my purpose and finding it in serving others",
    "Simply saying 'I trust you' during the hardest season of my life",
  ],
  "What worship looks like for me": [
    "Singing at the top of my lungs in church, tears and all",
    "Quiet mornings with coffee, my Bible, and a journal",
    "Playing guitar and writing songs that pour out my heart",
    "Being in nature and marvelling at creation",
    "Serving others — that's my worship in action",
  ],
  "How my faith shapes my relationships": [
    "I lead with grace and try to love unconditionally",
    "It reminds me that people are more important than being right",
    "I pray for the people I love, not just when things are hard",
    "It gives me patience and a long-term perspective",
    "I look for depth and authenticity over surface-level connection",
  ],
  "A moment God felt real to me": [
    "Watching the sunrise after an all-night prayer session",
    "When a stranger said exactly what I needed to hear at the right time",
    "The peace I felt during the most chaotic season of my life",
    "Seeing answered prayers in ways I never could have planned",
    "Holding a newborn and understanding the miracle of life",
  ],
  "What I'd want my partner to know about my faith": [
    "It's the most important part of who I am",
    "I'm not perfect but I'm intentional about growing",
    "I want us to pray together, not just side by side",
    "My faith is lived out, not just talked about",
    "I'm looking for someone to walk this journey with",
  ],
  "In 5 years I see myself": [
    "Settled down with a family, still adventuring on weekends",
    "Running my own business and travelling every few months",
    "Deeper in my faith, surrounded by people I love",
    "Living somewhere with mountains and a strong church community",
    "Doing work that matters and coming home to someone who gets me",
  ],
  "A life goal of mine": [
    "To visit every continent before I'm 40",
    "Open a small cafe with a bookshop attached",
    "Learn to speak 4 languages fluently",
    "Run a marathon on every continent",
    "Write a novel that makes someone cry (happy tears)",
  ],
  "The kind of family I dream of": [
    "Loud dinners, lots of laughter, faith at the centre",
    "Close-knit, adventurous, and rooted in love",
    "One that prays together and plays together",
    "A home full of warmth, good food, and open doors for friends",
    "Big enough for a dog, a garden, and Sunday pancakes",
  ],
  "Where I want to settle down": [
    "Somewhere with mountains, a lake, and a good church nearby",
    "A small city with a strong community feel",
    "Wherever feels like home — it's about the people, not the place",
    "Close enough to family but far enough for our own adventures",
    "A place where the kids can grow up outdoors",
  ],
  "Together, we could": [
    "Start a podcast nobody asked for",
    "Explore every farmers market in the city",
    "Have the best dinner party our friends have ever been to",
    "Serve together on a mission trip",
    "Build the world's most impressive blanket fort",
  ],
  "My biggest dream right now": [
    "To find someone who shares my faith and my sense of humour",
    "Starting something that makes a real difference in people's lives",
    "Travelling to a new country and just staying for a while",
    "Building a life that's both meaningful and fun",
    "Finding my person and building something lasting together",
  ],
  "What I'm building towards": [
    "A life of purpose, adventure, and deep relationships",
    "Financial freedom so I can give more and stress less",
    "A career that aligns with my values",
    "A future family rooted in faith and love",
    "Becoming the best version of myself, one day at a time",
  ],
  "The adventure I want to go on next": [
    "Backpacking through South America with nothing but a Bible and a camera",
    "A road trip through the Scottish Highlands",
    "Volunteering abroad for a summer",
    "Hiking the Camino de Santiago",
    "A month in Southeast Asia, discovering new cultures",
  ],
  "A cause I want to give my life to": [
    "Clean water access — because everyone deserves the basics",
    "Youth ministry — investing in the next generation",
    "Mental health awareness in faith communities",
    "Fighting poverty through education and empowerment",
    "Environmental stewardship — caring for God's creation",
  ],
  "The legacy I want to leave": [
    "That I loved people well and pointed them to something greater",
    "A family that knows God and knows they're loved",
    "That I made the world a little kinder than I found it",
    "Stories worth telling and a faith worth passing on",
    "That I lived courageously and loved generously",
  ],
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
  "You'd never know it, but I": [
    "Can solve a Rubik's cube in under two minutes",
    "Used to be terrified of public speaking, now I love it",
    "Have read the entire Bible cover to cover three times",
    "Was a competitive swimmer for 10 years",
    "Speak three languages but only well in two",
  ],
  "Dating me is like": [
    "Getting the aux cord — chaotic but entertaining",
    "Finding a $20 in your jacket pocket",
    "A crossword puzzle — challenging but rewarding",
    "A cozy rainy day — warm, comfortable, maybe some snacks",
    "A surprise road trip — spontaneous but always fun",
  ],
  "Typical Sunday": [
    "Church in the morning, brunch after, walk in nature",
    "Sleep in, morning worship, afternoon hike, evening cooking",
    "Morning service, coffee with the community, then rest",
    "Coffee shop, crossword puzzle, evening Bible study",
    "Church, farmers market, long lunch with friends",
  ],
  "I go crazy for": [
    "Homemade pasta and a good sunset",
    "Live worship music and rainy days with coffee",
    "A perfectly planned road trip",
    "Someone who can make me laugh until I cry",
    "Fresh bread straight out of the oven",
  ],
  "My simple pleasures": [
    "Fresh coffee, morning sun, and a good podcast",
    "A perfectly ripe avocado and sourdough toast",
    "Rain on the window while reading in bed",
    "Finding a new song that gives you chills",
    "The first bite of a warm chocolate chip cookie",
  ],
  "I could stay up all night talking about": [
    "Theology, purpose, and what we're all doing here",
    "Travel stories and the places that changed us",
    "The best albums of all time, no skips",
    "Dreams, goals, and where we see ourselves in 10 years",
    "Whether a hot dog is a sandwich (it's not)",
  ],
  "My most irrational fear": [
    "That a fish will touch my foot in the ocean",
    "Butterflies. They're just pretty moths and I don't trust them",
    "Revolving doors. What if it doesn't stop?",
    "That someone is always watching through my laptop camera",
    "Walking over subway grates in heels",
  ],
  "Two truths and a lie": [
    "I've been skydiving, I can juggle, I've met the Pope",
    "I speak fluent Italian, I've run a marathon, I can't cook",
    "I was born on Christmas, I have a twin, I've lived in 5 countries",
    "I've climbed Kilimanjaro, I hate chocolate, I play three instruments",
    "I was homeschooled, I've swum with sharks, I'm afraid of heights",
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
      denomination: pick(DENOMINATIONS.filter(d => d !== "Different")),
      distance: 1 + Math.floor(Math.random() * 25),
      photos,
      prompts: generatePromptAnswers(),
      interests: pickN(TRAITS_POOL, 4 + Math.floor(Math.random() * 4)),
      traits: pickN(TRAITS_POOL, 4 + Math.floor(Math.random() * 4)),
      lookingFor: pickN(TRAITS_POOL, 3 + Math.floor(Math.random() * 3)),
      isStandout: Math.random() < 0.15,
      lastActive: Math.random() < 0.4 ? "Just now" : Math.random() < 0.7 ? "Today" : "Recently",
    });
  }
  return profiles;
}

export { PROMPTS, PROMPT_CATEGORIES, INTERESTS_POOL, TRAITS_POOL, DENOMINATIONS };
