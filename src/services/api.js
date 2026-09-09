import { supabase } from "./supabase";

const compatibilityReasons = [
  "You both love hiking and share the same denomination",
  "Similar faith values and both enjoy worship music",
  "You're both in the same area and share key interests",
  "Strong faith alignment and shared love of travel",
  "Compatible denomination and mutual interests in community",
];

let standoutCounter = 0;

function mapProfile(p) {
  const isStandout = p.is_standout || standoutCounter++ % 3 === 0;
  return {
    id: p.id,
    name: p.name,
    age: p.age,
    gender: p.gender,
    height: p.height ? `${p.height} cm` : null,
    job: p.job || "",
    school: p.school || "",
    location: p.location_city || "",
    denomination: p.denomination || "",
    distance: null,
    photos: p.photos || [],
    prompts: p.prompts || [],
    interests: p.interests || [],
    isStandout: isStandout,
    compatibilityReason: isStandout ? compatibilityReasons[standoutCounter % compatibilityReasons.length] : null,
    lastActive: "Recently",
  };
}

// ─── AUTH ───

export async function register(data) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  });
  if (authError) throw new Error(authError.message);

  const profile = {
    id: authData.user.id,
    email: data.email,
    name: data.name,
    age: data.age,
    height: data.height || null,
    gender: data.gender,
    denomination: data.denomination || "",
    job: data.job || "",
    school: data.school || "",
    location_city: data.location || "",
    photos: data.photos || [],
    prompts: data.prompts || [],
    interests: data.interests || [],
  };

  const { error: profileError } = await supabase.from("profiles").insert(profile);
  if (profileError) throw new Error(profileError.message);

  return mapProfileToUser(profile);
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();
  if (profileError) throw new Error(profileError.message);

  return mapProfileToUser(profile);
}

export async function getMe() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (profileError) throw new Error(profileError.message);

  return mapProfileToUser(profile);
}

export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error) throw new Error(error.message);
  return mapProfileToUser(profile);
}

export async function updateProfile(data) {
  const { data: { user } } = await supabase.auth.getUser();
  const updates = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.age !== undefined) updates.age = data.age;
  if (data.height !== undefined) updates.height = data.height;
  if (data.denomination !== undefined) updates.denomination = data.denomination;
  if (data.job !== undefined) updates.job = data.job;
  if (data.school !== undefined) updates.school = data.school;
  if (data.location !== undefined) updates.location_city = data.location;
  if (data.prompts !== undefined) updates.prompts = data.prompts;
  if (data.interests !== undefined) updates.interests = data.interests;
  if (data.bio !== undefined) updates.bio = data.bio;
  if (data.filters !== undefined) updates.filters = data.filters;
  if (data.photos !== undefined) updates.photos = data.photos;

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapProfileToUser(profile);
}

// ─── DISCOVER ───

export async function getDiscover() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  const targetGender = me.gender === "male" ? "female" : "male";
  const minAge = me.filters?.minAge || 18;
  const maxAge = me.filters?.maxAge || 50;

  const { data: likedIds } = await supabase.from("likes").select("to_user").eq("from_user", user.id);
  const { data: skippedIds } = await supabase.from("skips").select("to_user").eq("from_user", user.id);

  const excludeIds = [
    user.id,
    ...(likedIds || []).map((l) => l.to_user),
    ...(skippedIds || []).map((s) => s.to_user),
  ];

  let query = supabase
    .from("profiles")
    .select("*")
    .eq("gender", targetGender)
    .eq("is_active", true)
    .gte("age", minAge)
    .lte("age", maxAge)
    .limit(20);

  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const { data: profiles, error } = await query;
  if (error) throw new Error(error.message);

  return (profiles || []).map(mapProfile);
}

// ─── LIKES ───

export async function sendLike(to, targetType, targetIndex, comment = null, isDove = false) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: existing } = await supabase
    .from("likes")
    .select("id")
    .eq("from_user", user.id)
    .eq("to_user", to)
    .single();

  if (existing) throw new Error("Already liked");

  const { error } = await supabase.from("likes").insert({
    from_user: user.id,
    to_user: to,
    target_type: targetType || "profile",
    target_index: targetIndex || 0,
    comment: comment || null,
    is_dove: isDove || false,
  });
  if (error) throw new Error(error.message);

  if (isDove) {
    const { data: me } = await supabase.from("profiles").select("doves").eq("id", user.id).single();
    await supabase.from("profiles").update({ doves: (me.doves || 3) - 1 }).eq("id", user.id);
  }

  const { data: mutual } = await supabase
    .from("likes")
    .select("id")
    .eq("from_user", to)
    .eq("to_user", user.id)
    .single();

  let matched = false;
  let matchId = null;

  if (mutual) {
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .insert({ user1: user.id, user2: to })
      .select()
      .single();
    if (!matchErr) {
      matched = true;
      matchId = match.id;
    }
  }

  return { matched, matchId };
}

export async function getLikesReceived() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: matchedUserIds } = await supabase
    .from("matches")
    .select("user1, user2")
    .or(`user1.eq.${user.id},user2.eq.${user.id}`);

  const matchedIds = (matchedUserIds || []).map((m) =>
    m.user1 === user.id ? m.user2 : m.user1
  );

  let query = supabase
    .from("likes")
    .select("*, from_profile:profiles!likes_from_user_fkey(*)")
    .eq("to_user", user.id)
    .order("created_at", { ascending: false });

  if (matchedIds.length > 0) {
    query = query.not("from_user", "in", `(${matchedIds.join(",")})`);
  }

  const { data: likes, error } = await query;
  if (error) throw new Error(error.message);

  return (likes || []).map((like) => ({
    id: like.id,
    fromId: like.from_user,
    profile: like.from_profile ? mapProfile(like.from_profile) : null,
    targetType: like.target_type,
    targetIndex: like.target_index,
    comment: like.comment,
    isDove: like.is_dove,
    timestamp: new Date(like.created_at).getTime(),
  }));
}

export async function dismissLike(likeId) {
  await supabase.from("likes").delete().eq("id", likeId);
}

export async function skipProfile(to) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("skips").insert({ from_user: user.id, to_user: to });
}

// ─── MATCHES ───

export async function getMatches() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: matches, error } = await supabase
    .from("matches")
    .select("*")
    .or(`user1.eq.${user.id},user2.eq.${user.id}`)
    .order("last_activity", { ascending: false });
  if (error) throw new Error(error.message);

  const results = [];
  for (const m of matches || []) {
    const otherId = m.user1 === user.id ? m.user2 : m.user1;
    const { data: otherProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", otherId)
      .single();

    const { data: lastMsg } = await supabase
      .from("messages")
      .select("*")
      .eq("match_id", m.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    results.push({
      id: m.id,
      profileId: otherId,
      profile: otherProfile ? mapProfile(otherProfile) : null,
      timestamp: new Date(m.last_activity || m.created_at).getTime(),
      lastMessage: lastMsg ? { text: lastMsg.text, sender: lastMsg.sender } : null,
    });
  }

  return results;
}

export async function getMessages(matchId) {
  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return (messages || []).map((msg) => ({
    id: msg.id,
    text: msg.text,
    sender: msg.sender,
    timestamp: new Date(msg.created_at).getTime(),
    read: msg.read,
  }));
}

export async function sendMessage(matchId, text) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: message, error } = await supabase
    .from("messages")
    .insert({ match_id: matchId, sender: user.id, text })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("matches").update({ last_activity: new Date().toISOString() }).eq("id", matchId);

  return {
    id: message.id,
    text: message.text,
    sender: message.sender,
    timestamp: new Date(message.created_at).getTime(),
  };
}

export async function unmatch(matchId) {
  await supabase.from("messages").delete().eq("match_id", matchId);
  await supabase.from("matches").delete().eq("id", matchId);
}

// ─── HELPERS ───

function mapProfileToUser(p) {
  return {
    _id: p.id,
    id: p.id,
    email: p.email,
    name: p.name,
    age: p.age,
    height: p.height,
    gender: p.gender,
    denomination: p.denomination,
    job: p.job,
    school: p.school,
    location: { city: p.location_city },
    photos: p.photos || [],
    prompts: p.prompts || [],
    interests: p.interests || [],
    bio: p.bio || "",
    doves: p.doves ?? 3,
    filters: p.filters || { minAge: 18, maxAge: 50, maxDistance: 80, denomination: "" },
    isActive: p.is_active,
    lastActive: p.last_active,
  };
}

// Legacy token functions — no longer needed with Supabase auth but kept for compatibility
export function getToken() {
  return supabase.auth.getSession().then(({ data }) => data?.session?.access_token || null);
}

export function setToken() {}

export async function clearToken() {
  await supabase.auth.signOut();
}
