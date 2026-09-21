import { supabase } from "./supabase";

const compatibilityReasons = [
  "You both love hiking and share the same denomination",
  "Similar faith values and both enjoy worship music",
  "You're both in the same area and share key interests",
  "Strong faith alignment and shared love of travel",
  "Compatible denomination and mutual interests in community",
];

let standoutCounter = 0;

// Some rows have a GeoJSON blob saved in location_city by an earlier onboarding build — unpack it
function parseLocation(p) {
  let city = p.location_city || "";
  let lat = p.location_lat || null;
  let lng = p.location_lng || null;
  if (typeof city === "string" && city.startsWith("{")) {
    try {
      const g = JSON.parse(city);
      city = g.city || "";
      if (!lat && Array.isArray(g.coordinates)) { lng = g.coordinates[0]; lat = g.coordinates[1]; }
    } catch { city = ""; }
  }
  return { city, lat, lng };
}

function mapProfile(p) {
  const isStandout = p.is_standout || standoutCounter++ % 3 === 0;
  const loc = parseLocation(p);
  return {
    id: p.id,
    name: p.name,
    age: p.age,
    gender: p.gender,
    height: p.height ? `${p.height} cm` : null,
    job: p.job || "",
    school: p.school || "",
    location: loc.city,
    lat: loc.lat,
    lng: loc.lng,
    denomination: p.denomination || "",
    distance: null,
    photos: p.photos || [],
    prompts: p.prompts || [],
    interests: p.interests || [],
    traits: p.traits || [],
    lookingFor: p.looking_for || [],
    isStandout: isStandout,
    compatibilityReason: isStandout ? compatibilityReasons[standoutCounter % compatibilityReasons.length] : null,
    lastActive: "Recently",
  };
}

// ─── AUTH ───

// Local session read — avoids a network round-trip to the auth server on every API call
async function currentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}

function withTimeout(promise, ms, message = "Request timed out — please check your connection and try again") {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export async function sendOtp(phone) {
  const { data, error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw new Error(error.message);
  return data;
}

export async function verifyOtp(phone, token) {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) throw new Error(error.message);
  return data;
}

export async function setPassword(password) {
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
  return data;
}

export async function loginWithPhone(phone, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ phone, password });
  if (error) throw new Error(error.message);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);

  // Auth account exists but onboarding never created the profile row
  if (!profile) return null;

  return mapProfileToUser(profile, data.user.phone);
}

export async function checkProfileExists() {
  const user = await currentUser();
  if (!user) return false;
  const { data } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  return !!data;
}

export async function createProfile(data) {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated");

  const profile = {
    id: user.id,
    email: data.email || user.email || null,
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

export async function register(data) {
  return createProfile(data);
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
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error: profileError } = await withTimeout(
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    20000
  );
  if (profileError) throw new Error(profileError.message);

  if (typeof profile.location_city === "string" && profile.location_city.startsWith("{")) {
    const loc = parseLocation(profile);
    await supabase
      .from("profiles")
      .update({ location_city: loc.city, location_lat: loc.lat, location_lng: loc.lng })
      .eq("id", user.id);
    Object.assign(profile, { location_city: loc.city, location_lat: loc.lat, location_lng: loc.lng });
  }

  return mapProfileToUser(profile, user.phone);
}

export async function getProfile() {
  const user = await currentUser();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error) throw new Error(error.message);
  return mapProfileToUser(profile);
}

export async function updateProfile(data) {
  const user = await currentUser();
  const updates = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.age !== undefined) updates.age = data.age;
  if (data.height !== undefined) updates.height = data.height;
  if (data.denomination !== undefined) updates.denomination = data.denomination;
  if (data.job !== undefined) updates.job = data.job;
  if (data.school !== undefined) updates.school = data.school;
  if (data.location !== undefined) updates.location_city = data.location;
  if (data.locationLat !== undefined) updates.location_lat = data.locationLat;
  if (data.locationLng !== undefined) updates.location_lng = data.locationLng;
  if (data.prompts !== undefined) updates.prompts = data.prompts;
  if (data.interests !== undefined) updates.interests = data.interests;
  if (data.traits !== undefined) updates.traits = data.traits;
  if (data.whoAreYou !== undefined) updates.who_are_you = data.whoAreYou;
  if (data.lookingFor !== undefined) updates.looking_for = data.lookingFor;
  if (data.bio !== undefined) updates.bio = data.bio;
  if (data.filters !== undefined) updates.filters = data.filters;
  if (data.photos !== undefined) updates.photos = data.photos;

  const { data: profile, error } = await withTimeout(
    supabase.from("profiles").update(updates).eq("id", user.id).select().single(),
    20000
  );
  if (error) throw new Error(error.message);
  return mapProfileToUser(profile, user.phone);
}

// ─── DISCOVER ───

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getDiscover() {
  const user = await currentUser();
  const { data: me } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  const targetGender = me.gender === "male" ? "female" : "male";
  const minAge = me.filters?.minAge || 18;
  const maxAge = me.filters?.maxAge || 50;
  const maxDistance = me.filters?.maxDistance || 80;
  const myLat = me.location_lat;
  const myLng = me.location_lng;

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
    .limit(100);

  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const { data: profiles, error } = await query;
  if (error) throw new Error(error.message);

  let filtered = (profiles || []).map(mapProfile);
  if (myLat && myLng) {
    filtered = filtered.filter((p) => {
      if (!p.lat || !p.lng) return true;
      return haversineKm(myLat, myLng, p.lat, p.lng) <= maxDistance;
    });
  }

  return filtered;
}

// ─── LIKES ───

export async function sendLike(to, targetType, targetIndex, comment = null, isDove = false) {
  const user = await currentUser();

  const { data: existing } = await supabase
    .from("likes")
    .select("id")
    .eq("from_user", user.id)
    .eq("to_user", to)
    .maybeSingle();

  if (existing) throw new Error("Already liked");

  const { error } = await withTimeout(supabase.from("likes").insert({
    from_user: user.id,
    to_user: to,
    target_type: targetType || "profile",
    target_index: targetIndex || 0,
    comment: comment || null,
    is_dove: isDove || false,
  }), 20000);
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
    .maybeSingle();

  let matched = false;
  let matchId = null;

  if (mutual) {
    const { data: existingMatch } = await supabase
      .from("matches")
      .select("id")
      .or(`and(user1.eq.${user.id},user2.eq.${to}),and(user1.eq.${to},user2.eq.${user.id})`)
      .maybeSingle();

    if (existingMatch) {
      matched = true;
      matchId = existingMatch.id;
    } else {
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
  }

  return { matched, matchId };
}

export async function getLikesReceived() {
  const user = await currentUser();

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
  const user = await currentUser();
  await supabase.from("skips").insert({ from_user: user.id, to_user: to });
}

// ─── MATCHES ───

export async function getMatches() {
  const user = await currentUser();

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
      .maybeSingle();

    let preview = lastMsg ? { text: lastMsg.text, sender: lastMsg.sender } : null;
    if (!preview) {
      const { data: likeComment } = await supabase
        .from("likes")
        .select("from_user, comment, is_dove")
        .or(`and(from_user.eq.${m.user1},to_user.eq.${m.user2}),and(from_user.eq.${m.user2},to_user.eq.${m.user1})`)
        .not("comment", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (likeComment) {
        preview = { text: (likeComment.is_dove ? "🕊️ " : "") + likeComment.comment, sender: likeComment.from_user };
      }
    }

    results.push({
      id: m.id,
      profileId: otherId,
      profile: otherProfile ? mapProfile(otherProfile) : null,
      timestamp: new Date(m.last_activity || m.created_at).getTime(),
      lastMessage: preview,
      nudgeAt: m.nudge_at ? new Date(m.nudge_at).getTime() : null,
      deadlinePaused: !!m.deadline_paused,
      videoCallAt: m.video_call_at ? new Date(m.video_call_at).getTime() : null,
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

  const mapped = (messages || []).map((msg) => ({
    id: msg.id,
    text: msg.text,
    sender: msg.sender,
    timestamp: new Date(msg.created_at).getTime(),
    read: msg.read,
  }));

  // Prepend like comments as opening messages in chat
  try {
    const { data: match } = await supabase.from("matches").select("user1, user2").eq("id", matchId).single();
    if (match) {
      const { data: likes } = await supabase
        .from("likes")
        .select("from_user, comment, is_dove, created_at")
        .or(`and(from_user.eq.${match.user1},to_user.eq.${match.user2}),and(from_user.eq.${match.user2},to_user.eq.${match.user1})`)
        .not("comment", "is", null)
        .order("created_at", { ascending: true });
      if (likes?.length > 0) {
        const likeMessages = likes.map((like) => ({
          id: `like-${like.from_user}`,
          text: (like.is_dove ? "🕊️ " : "") + like.comment,
          sender: like.from_user,
          timestamp: new Date(like.created_at).getTime(),
          read: true,
        }));
        return [...likeMessages, ...mapped];
      }
    }
  } catch (_) {}

  return mapped;
}

export async function sendMessage(matchId, text) {
  const user = await currentUser();

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

// ─── DATE INVITATIONS ───

export async function createDateInvitation(matchId, data) {
  const user = await currentUser();
  const { data: invitation, error } = await supabase
    .from("date_invitations")
    .insert({
      match_id: matchId,
      from_user: user.id,
      date_type: data.dateType,
      location: data.location,
      wardrobe: data.wardrobe,
      proposed_times: data.proposedTimes,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return invitation;
}

export async function getDateInvitations(matchId) {
  const { data, error } = await supabase
    .from("date_invitations")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function respondToDate(invitationId, selectedTimes) {
  const { data, error } = await supabase
    .from("date_invitations")
    .update({ response_times: selectedTimes, status: "responded" })
    .eq("id", invitationId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function declineDate(invitationId, reasons) {
  const { data, error } = await supabase
    .from("date_invitations")
    .update({ status: "declined", decline_reasons: reasons })
    .eq("id", invitationId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (reasons.includes("Too soon, need more time chatting")) {
    await supabase
      .from("matches")
      .update({ deadline_paused: true })
      .eq("id", data.match_id);
  }

  return data;
}

export async function confirmDate(invitationId, confirmedTime) {
  const { data, error } = await supabase
    .from("date_invitations")
    .update({ confirmed_time: confirmedTime, status: "confirmed" })
    .eq("id", invitationId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function startVideoCall(matchId) {
  const { error } = await supabase
    .from("matches")
    .update({ video_call_at: new Date().toISOString() })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function sendNudge(matchId) {
  const { error } = await supabase
    .from("matches")
    .update({ nudge_at: new Date().toISOString() })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

// ─── HELPERS ───

function mapProfileToUser(p, authPhone) {
  return {
    _id: p.id,
    id: p.id,
    email: p.email,
    phone: authPhone || "",
    name: p.name,
    age: p.age,
    height: p.height,
    gender: p.gender,
    denomination: p.denomination,
    job: p.job,
    school: p.school,
    location: parseLocation(p),
    photos: p.photos || [],
    prompts: p.prompts || [],
    interests: p.interests || [],
    traits: p.traits || [],
    lookingFor: p.looking_for || [],
    bio: p.bio || "",
    doves: p.doves ?? 3,
    filters: p.filters || { minAge: 18, maxAge: 50, maxDistance: 80, denomination: "" },
    isActive: p.is_active,
    lastActive: p.last_active,
    subscriptionStatus: p.subscription_status || "none",
  };
}

// ─── PHOTOS ───

export function compressPhoto(file, maxWidth = 800, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, (maxWidth * 1.33) / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

// Legacy token functions — no longer needed with Supabase auth but kept for compatibility
export function getToken() {
  return supabase.auth.getSession().then(({ data }) => data?.session?.access_token || null);
}

export function setToken() {}

export async function clearToken() {
  await supabase.auth.signOut();
}
