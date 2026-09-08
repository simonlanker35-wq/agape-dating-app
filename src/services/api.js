const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function getToken() {
  return localStorage.getItem("agape_token");
}

function setToken(token) {
  localStorage.setItem("agape_token", token);
}

function clearToken() {
  localStorage.removeItem("agape_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || "Request failed");
  return data;
}

const compatibilityReasons = [
  "You both love hiking and share the same denomination",
  "Similar faith values and both enjoy worship music",
  "You're both in the same area and share key interests",
  "Strong faith alignment and shared love of travel",
  "Compatible denomination and mutual interests in community",
];

let standoutCounter = 0;

function mapProfile(p) {
  const isStandout = standoutCounter++ % 3 === 0;
  return {
    id: p._id,
    name: p.name,
    age: p.age,
    gender: p.gender,
    height: p.height ? `${p.height} cm` : null,
    job: p.job || "",
    school: p.school || "",
    location: p.location?.city || "",
    denomination: p.denomination || "",
    distance: null,
    photos: p.photos || [],
    prompts: p.prompts || [],
    interests: p.interests || [],
    isStandout,
    compatibilityReason: isStandout ? compatibilityReasons[standoutCounter % compatibilityReasons.length] : null,
    lastActive: "Recently",
  };
}

export async function register(data) {
  const res = await request("/auth/register", { method: "POST", body: data });
  setToken(res.token);
  return res.user;
}

export async function login(email, password) {
  const res = await request("/auth/login", { method: "POST", body: { email, password } });
  setToken(res.token);
  return res.user;
}

export async function getMe() {
  const res = await request("/auth/me");
  return res.user;
}

export async function getProfile() {
  const res = await request("/profile");
  return res.profile;
}

export async function updateProfile(data) {
  const res = await request("/profile", { method: "PATCH", body: data });
  return res.profile;
}

export async function getDiscover() {
  const res = await request("/discover");
  return res.profiles.map(mapProfile);
}

export async function sendLike(to, targetType, targetIndex, comment = null, isDove = false) {
  const body = { to, targetType, targetIndex };
  if (comment) body.comment = comment;
  if (isDove) body.isDove = true;
  const res = await request("/likes", { method: "POST", body });
  return res;
}

export async function getLikesReceived() {
  const res = await request("/likes/received");
  return res.likes.map((like) => ({
    id: like._id,
    fromId: like.from._id || like.from,
    profile: like.from._id ? mapProfile(like.from) : null,
    targetType: like.targetType,
    targetIndex: like.targetIndex,
    comment: like.comment,
    isDove: like.isDove,
    timestamp: new Date(like.createdAt).getTime(),
  }));
}

export async function dismissLike(likeId) {
  await request(`/likes/${likeId}`, { method: "DELETE" });
}

export async function skipProfile(to) {
  await request("/likes/skip", { method: "POST", body: { to } });
}

export async function getMatches() {
  const res = await request("/matches");
  return res.matches.map((m) => {
    const other = m.user;
    return {
      id: m._id,
      profileId: other._id,
      profile: mapProfile(other),
      timestamp: new Date(m.lastActivity || m.createdAt).getTime(),
      lastMessage: m.lastMessage,
    };
  });
}

export async function getMessages(matchId) {
  const res = await request(`/matches/${matchId}/messages`);
  return res.messages.map((msg) => ({
    id: msg._id,
    text: msg.text,
    sender: msg.sender,
    timestamp: new Date(msg.createdAt).getTime(),
    read: msg.read,
  }));
}

export async function sendMessage(matchId, text) {
  const res = await request(`/matches/${matchId}/messages`, {
    method: "POST",
    body: { text },
  });
  return {
    id: res.message._id,
    text: res.message.text,
    sender: res.message.sender,
    timestamp: new Date(res.message.createdAt).getTime(),
  };
}

export async function unmatch(matchId) {
  await request(`/matches/${matchId}`, { method: "DELETE" });
}

export { getToken, setToken, clearToken };
