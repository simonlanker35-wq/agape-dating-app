import { supabase } from "./supabase";



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
    // Team-approved verification selfies are shown after the regular photos
    photos: [...(p.photos || []), ...["church", "bible"].map((k) => p.verified_photos?.[k]).filter(Boolean)],
    isVerified: ["church", "bible"].some((k) => !!p.verified_photos?.[k]),
    prompts: p.prompts || [],
    interests: p.interests || [],
    traits: p.traits || [],
    lookingFor: p.looking_for || [],
    whoAreYou: p.who_are_you || [],
    details: p.details || {},
    isStandout: !!p.is_standout,
    filters: p.filters || null,
    createdAt: p.created_at || null,
    lastActive: p.last_active || null,
  };
}

// Considered online when active in the last 5 minutes
export function isOnline(lastActive) {
  if (!lastActive) return false;
  const t = new Date(lastActive).getTime();
  return Number.isFinite(t) && Date.now() - t < 5 * 60 * 1000;
}

// Heartbeat: mark the current user as active now. Fire-and-forget.
export async function touchActivity() {
  try {
    const user = await currentUser();
    if (!user) return;
    await supabase.from("profiles").update({ last_active: new Date().toISOString() }).eq("id", user.id);
  } catch (_) {}
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

  let { error: profileError } = await supabase.from("profiles").insert(profile);

  // The same email may already sit on another account (e.g. typed into a phone sign-up earlier) — keep going without it
  if (profileError && profileError.code === "23505" && profile.email) {
    profile.email = null;
    ({ error: profileError } = await supabase.from("profiles").insert(profile));
  }
  if (profileError) throw new Error(profileError.message);

  return mapProfileToUser(profile, user.phone);
}

export async function register(data) {
  return createProfile(data);
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profile) return null;

  return mapProfileToUser(profile, data.user.phone);
}

export const login = signInWithEmail;

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
  if (error) throw new Error(error.message);
  return { confirmed: !!data.session, user: data.user };
}

export async function signInWithProvider(provider) {
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
  if (error) throw new Error(error.message);
}

// Sends a reset link. Goes through the password-reset function, which also works for accounts
// created with a phone number (their email lives on the profile, not on the login).
export async function sendPasswordResetEmail(email) {
  const clean = String(email || "").trim().toLowerCase();
  const redirectTo = window.location.origin;
  let unreachable = false;
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke("password-reset", { body: { email: clean, redirectTo } }),
      25000
    );
    if (!error && data?.ok) return;
    if (error) {
      // The function answered with an error status: show its message
      const status = error.context?.status;
      let detail = null;
      try { detail = await error.context?.json?.(); } catch (_) {}
      if (detail?.error) throw new Error(detail.error);
      if (status === 404 || !status) unreachable = true;
      else throw new Error("Could not send the reset email. Please try again.");
    } else if (data?.error) {
      throw new Error(data.error);
    }
  } catch (err) {
    if (!unreachable && !/timed out|Failed to fetch|Failed to send a request/i.test(err.message || "")) throw err;
    unreachable = true;
  }
  if (unreachable) {
    const { error } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo });
    if (error) throw new Error(error.message);
  }
}

export async function getSessionUser() {
  return currentUser();
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
  // name and age are set once at sign-up (createProfile) and are deliberately not editable afterwards
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
  if (data.details !== undefined) updates.details = data.details;
  if (data.filters !== undefined) updates.filters = data.filters;
  if (data.notificationPrefs !== undefined) updates.notification_prefs = data.notificationPrefs;
  if (data.paused !== undefined) updates.paused = !!data.paused;
  if (data.photos !== undefined) updates.photos = (data.photos || []).filter(isAllowedMediaUrl);

  const { data: profile, error } = await withTimeout(
    supabase.from("profiles").update(updates).eq("id", user.id).select().single(),
    20000
  );
  if (error) throw new Error(error.message);
  return mapProfileToUser(profile, user.phone);
}

// Photo addresses must be images we produced, app paths or https links; anything else is dropped
export function isAllowedMediaUrl(u) {
  if (typeof u !== "string" || !u) return false;
  if (u.startsWith("data:image/")) return true;
  if (u.startsWith("/") && !u.startsWith("//")) return true;
  try {
    return new URL(u).protocol === "https:";
  } catch (_) { return false; }
}

// ─── OTHER PEOPLE'S PROFILES ───

const missingRelation = (err) => /relation .* does not exist|schema cache|Could not find the table/i.test(err?.message || "");

// Other members are read through the profiles_public view, which leaves out private columns.
// Until security_hardening.sql has run, the table itself is used.
function publicProfiles() {
  return supabase.from("profiles_public");
}

export async function fetchPublicProfiles(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return {};
  let { data, error } = await publicProfiles().select("*").in("id", unique);
  if (error && missingRelation(error)) ({ data, error } = await supabase.from("profiles").select("*").in("id", unique));
  if (error) throw new Error(error.message);
  return Object.fromEntries((data || []).map((p) => [p.id, p]));
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

  const buildQuery = (hidePaused, fromTable = false) => {
    let q = (fromTable ? supabase.from("profiles") : publicProfiles())
      .select("*")
      .eq("gender", targetGender)
      .eq("is_active", true)
      .gte("age", minAge)
      .lte("age", maxAge)
      .limit(100);
    if (hidePaused) q = q.eq("paused", false);
    if (excludeIds.length > 0) q = q.not("id", "in", `(${excludeIds.join(",")})`);
    return q;
  };

  let { data: profiles, error } = await buildQuery(true);
  // Before security_hardening.sql the view does not exist; before settings_safety.sql there is no "paused"
  if (error && missingRelation(error)) ({ data: profiles, error } = await buildQuery(true, true));
  if (error && /paused/i.test(error.message || "")) ({ data: profiles, error } = await buildQuery(false, true));
  if (error) throw new Error(error.message);

  let filtered = (profiles || []).map(mapProfile);
  const reliability = await getReliability(filtered.map((p) => p.id));
  filtered.forEach((p) => { p.reliability = reliability[p.id] || null; });
  if (myLat && myLng) {
    filtered = filtered.filter((p) => {
      if (!p.lat || !p.lng) return true;
      return haversineKm(myLat, myLng, p.lat, p.lng) <= maxDistance;
    });
  }

  return filtered;
}

// ─── LIKES ───

// The database refuses a like, Dove or reveal beyond the plan's allowance with these codes
export function limitMessage(msg) {
  if (/LIKE_LIMIT/.test(msg || "")) return "You've used all your likes for today";
  if (/DOVE_LIMIT/.test(msg || "")) return "You've used all your Doves for this week";
  if (/REVEAL_LIMIT/.test(msg || "")) return "You've used your reveal for this week";
  return msg;
}
export function isLimitError(err) { return /LIKE_LIMIT|DOVE_LIMIT|REVEAL_LIMIT|all your likes|all your Doves|your reveal for this week/.test(err?.message || ""); }

// How many likes, Doves and reveals are used and allowed, counted by the database
export async function getUsage() {
  const { data, error } = await supabase.rpc("usage_limits");
  if (error) {
    if (missingRelation(error) || /function/i.test(error.message || "")) return null; // usage_limits.sql not run yet
    throw new Error(error.message);
  }
  if (!data) return null;
  return {
    premium: !!data.premium,
    likesUsed: Number(data.likesUsed) || 0, likesLimit: Number(data.likesLimit) || 0,
    dovesUsed: Number(data.dovesUsed) || 0, dovesLimit: Number(data.dovesLimit) || 0,
    revealsUsed: Number(data.revealsUsed) || 0, revealsLimit: Number(data.revealsLimit) || 0,
    likesResetAt: data.likesResetAt ? new Date(data.likesResetAt).getTime() : null,
    dovesResetAt: data.dovesResetAt ? new Date(data.dovesResetAt).getTime() : null,
  };
}

// Reveal who sent a blurred like in Sparks; the database counts it against the weekly allowance
export async function revealLike(likeId) {
  const user = await currentUser();
  const { error } = await supabase.from("spark_reveals").insert({ user_id: user.id, like_id: likeId });
  if (error && missingRelation(error)) return false; // usage_limits.sql not run yet: counted on this device only
  if (error && error.code === "23505") return true; // already revealed
  if (error) throw new Error(limitMessage(error.message));
  return true;
}

export async function sendLike(to, targetType, targetIndex, comment = null, isDove = false) {
  const user = await currentUser();

  const { data: existing } = await supabase
    .from("likes")
    .select("id")
    .eq("from_user", user.id)
    .eq("to_user", to)
    .limit(1)
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
  if (error) throw new Error(limitMessage(error.message));

  // Any like from them to me (heart, comment or dove) makes this a match
  const { data: mutual } = await supabase
    .from("likes")
    .select("id")
    .eq("from_user", to)
    .eq("to_user", user.id)
    .limit(1)
    .maybeSingle();

  let matched = false;
  let matchId = null;

  if (mutual) {
    const { data: existingMatch } = await supabase
      .from("matches")
      .select("id")
      .or(`and(user1.eq.${user.id},user2.eq.${to}),and(user1.eq.${to},user2.eq.${user.id})`)
      .limit(1)
      .maybeSingle();

    if (existingMatch) {
      matched = true;
      matchId = existingMatch.id;
    } else {
      // The database checks that both likes exist before creating the match
      let { data: createdId, error: matchErr } = await supabase.rpc("create_match_if_mutual", { p_other: to });
      if (matchErr && /function .*create_match_if_mutual|schema cache/i.test(matchErr.message || "")) {
        // Before security_hardening.sql has run
        const { data: match, error: insErr } = await supabase.from("matches").insert({ user1: user.id, user2: to }).select().single();
        createdId = match?.id || null;
        matchErr = insErr;
      }
      if (!matchErr && createdId) {
        matched = true;
        matchId = createdId;
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
    .select("*")
    .eq("to_user", user.id)
    .order("created_at", { ascending: false });

  if (matchedIds.length > 0) {
    query = query.not("from_user", "in", `(${matchedIds.join(",")})`);
  }

  const { data: likes, error } = await query;
  if (error) throw new Error(error.message);

  const senders = await fetchPublicProfiles((likes || []).map((l) => l.from_user));
  const reliability = await getReliability((likes || []).map((l) => l.from_user));
  // Reveals are stored per account, so they survive a new device or a cleared browser
  const { data: reveals } = await supabase.from("spark_reveals").select("like_id").eq("user_id", user.id);
  const revealed = new Set((reveals || []).map((r) => r.like_id));
  return (likes || []).map((like) => ({
    id: like.id,
    fromId: like.from_user,
    revealed: revealed.has(like.id),
    profile: senders[like.from_user] ? { ...mapProfile(senders[like.from_user]), reliability: reliability[like.from_user] || null } : null,
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

  const partnerIds = (matches || []).map((m) => (m.user1 === user.id ? m.user2 : m.user1));
  const partners = await fetchPublicProfiles(partnerIds);
  const results = [];
  for (const m of matches || []) {
    const otherId = m.user1 === user.id ? m.user2 : m.user1;
    const otherProfile = partners[otherId] || null;

    const { data: lastMsg } = await supabase
      .from("messages")
      .select("*")
      .eq("match_id", m.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let preview = lastMsg ? { text: lastMsg.text, sender: lastMsg.sender, read: !!lastMsg.read, timestamp: new Date(lastMsg.created_at).getTime() } : null;
    if (!preview) {
      const { data: likeComment } = await supabase
        .from("likes")
        .select("from_user, comment, is_dove, target_type")
        .or(`and(from_user.eq.${m.user1},to_user.eq.${m.user2}),and(from_user.eq.${m.user2},to_user.eq.${m.user1})`)
        .not("comment", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (likeComment) {
        // Comment text stays hidden until the date is confirmed; the list only hints that it exists
        preview = { text: (likeComment.is_dove ? "🕊️ " : "") + likeComment.comment, sender: likeComment.from_user, isComment: true, targetType: likeComment.target_type, isDove: likeComment.is_dove };
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

  const reliability = await getReliability(results.map((r) => r.profileId));
  results.forEach((r) => { if (r.profile) r.profile.reliability = reliability[r.profileId] || null; });

  return results;
}

export async function getMessages(matchId) {
  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const mapped = (messages || []).map(mapMessage);

  // Prepend like comments as opening messages in chat
  try {
    const { data: match } = await supabase.from("matches").select("user1, user2").eq("id", matchId).single();
    if (match) {
      const { data: likes } = await supabase
        .from("likes")
        .select("from_user, comment, is_dove, target_type, created_at")
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
          isComment: true,
          targetType: like.target_type,
          isDove: like.is_dove,
        }));
        return [...likeMessages, ...mapped];
      }
    }
  } catch (_) {}

  return mapped;
}

// media: { type: "image" | "audio", url, duration } — text is a readable fallback for previews and notifications
// replyTo: id of the message this one answers (optional)
export async function sendMessage(matchId, text, media = null, replyTo = null) {
  const user = await currentUser();

  const row = { match_id: matchId, sender: user.id, text };
  if (media) {
    row.media_type = media.type;
    row.media_url = media.url;
    row.media_duration = media.duration ?? null;
  }
  if (replyTo) row.reply_to = replyTo;
  let { data: message, error } = await withTimeout(
    supabase.from("messages").insert(row).select().single(),
    20000
  );
  // Replies not set up on the server yet: send it as a normal message rather than losing it
  if (error && replyTo && /reply_to/i.test(error.message || "")) {
    delete row.reply_to;
    ({ data: message, error } = await withTimeout(supabase.from("messages").insert(row).select().single(), 20000));
  }
  if (error) throw new Error(error.message);

  await supabase.from("matches").update({ last_activity: new Date().toISOString() }).eq("id", matchId);

  return mapMessage(message);
}

function mapMessage(msg) {
  return {
    id: msg.id,
    text: msg.text,
    sender: msg.sender,
    timestamp: new Date(msg.created_at).getTime(),
    read: msg.read,
    media: msg.media_url ? { type: msg.media_type, url: msg.media_url, duration: msg.media_duration } : null,
    reactions: msg.reactions || {},
    replyTo: msg.reply_to || null,
  };
}

// Everything they sent in this chat counts as read once the chat is open
export async function markMessagesRead(matchId) {
  const user = await currentUser();
  const { error } = await supabase.from("messages").update({ read: true }).eq("match_id", matchId).neq("sender", user.id).eq("read", false);
  if (error) console.warn("Could not mark messages read:", error.message);
}

// Set my reaction on a message (empty emoji removes it). Returns the message's reactions map.
export async function reactToMessage(messageId, emoji) {
  const { data, error } = await withTimeout(
    supabase.rpc("react_to_message", { p_message_id: messageId, p_emoji: emoji || "" }),
    15000
  );
  if (error) throw new Error(error.message);
  if (data == null) throw new Error("Could not save the reaction");
  return data;
}

// ─── VERIFICATION SELFIES ───

// My own selfies and their review state: { church: { url, status, note }, bible: { ... } }
export async function getMyVerifications() {
  const user = await currentUser();
  if (!user) return {};
  const { data, error } = await supabase.from("photo_verifications").select("kind, url, status, note").eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data || []).map((r) => [r.kind, { url: r.url, status: r.status, note: r.note }]));
}

// Upload a selfie for review. It is private and "pending" until the team approves it.
export async function submitVerification(kind, dataUrl) {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");
  let url = dataUrl;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    url = await uploadMedia(blob, "verify", "jpg", "image/jpeg");
  } catch (_) {
    // Storage bucket not available: keep the compressed image inline so the upload still works
  }
  const { data, error } = await withTimeout(
    supabase.from("photo_verifications").upsert({ user_id: user.id, kind, url, status: "pending" }, { onConflict: "user_id,kind" }).select("kind, url, status, note").single(),
    30000
  );
  if (error) throw new Error(error.message);
  return { url: data.url, status: data.status, note: data.note };
}

export async function removeVerification(kind) {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase.from("photo_verifications").delete().eq("user_id", user.id).eq("kind", kind);
  if (error) throw new Error(error.message);
}

// ─── LIVE UPDATES (Supabase Realtime) ───

// Calls onEvent whenever one of the listed tables changes. Returns a function that stops listening.
// specs: [{ table, filter? }] — filter uses the realtime syntax, e.g. "match_id=eq.<id>".
export function subscribeLive(name, specs, onEvent) {
  let channel;
  try {
    channel = supabase.channel(name);
    specs.forEach((spec) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table: spec.table, ...(spec.filter ? { filter: spec.filter } : {}) }, (payload) => onEvent(spec.table, payload));
    });
    channel.subscribe();
  } catch (err) {
    console.warn("Live updates unavailable:", err?.message || err);
  }
  return () => { try { if (channel) supabase.removeChannel(channel); } catch (_) {} };
}

// ─── SAFETY: blocks and reports ───

const notSetUp = (err) => /relation .* does not exist|schema cache|Could not find the table/i.test(err?.message || "");

// People I blocked, with the name and photo saved at the time (their profile is hidden from me afterwards)
export async function getBlocks() {
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await supabase.from("blocks").select("blocked, blocked_name, blocked_photo, created_at").eq("blocker", user.id).order("created_at", { ascending: false });
  if (error) { if (notSetUp(error)) return []; throw new Error(error.message); }
  return (data || []).map((b) => ({ id: b.blocked, name: b.blocked_name, photo: b.blocked_photo, timestamp: new Date(b.created_at).getTime() }));
}

export async function blockUser(profile) {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase.from("blocks").upsert(
    { blocker: user.id, blocked: profile.id, blocked_name: profile.name || null, blocked_photo: profile.photos?.[0] || null },
    { onConflict: "blocker,blocked" }
  );
  if (error) throw new Error(notSetUp(error) ? "Blocking isn't available right now. Please try again later." : error.message);
}

export async function unblockUser(blockedId) {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase.from("blocks").delete().eq("blocker", user.id).eq("blocked", blockedId);
  if (error) throw new Error(error.message);
}

export async function reportUser({ profile, reason, details = null, source = "app" }) {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase.from("reports").insert({
    reporter: user.id, reported: profile.id, reported_name: profile.name || null, reported_photo: profile.photos?.[0] || null,
    reason, details, source,
  }).select("id, created_at, status").single();
  if (error) throw new Error(notSetUp(error) ? "Reporting isn't available right now. Please try again later." : error.message);
  return { id: data.id, profileId: profile.id, name: profile.name, photo: profile.photos?.[0], reason, status: data.status, timestamp: new Date(data.created_at).getTime() };
}

export async function getMyReports() {
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await supabase.from("reports").select("id, reported, reported_name, reported_photo, reason, status, created_at").eq("reporter", user.id).order("created_at", { ascending: false });
  if (error) { if (notSetUp(error)) return []; throw new Error(error.message); }
  return (data || []).map((r) => ({ id: r.id, profileId: r.reported, name: r.reported_name, photo: r.reported_photo, reason: r.reason, status: r.status, timestamp: new Date(r.created_at).getTime() }));
}

// Deletes everything about the account through the delete-account function, then signs out
export async function deleteAccount() {
  const { data, error } = await withTimeout(supabase.functions.invoke("delete-account", { body: {} }), 60000);
  if (error) {
    let detail = null;
    try { detail = await error.context?.json?.(); } catch (_) {}
    throw new Error(detail?.error || "The account could not be deleted right now. Please try again or email us.");
  }
  if (!data?.ok) throw new Error(data?.error || "The account could not be deleted right now.");
  try { await supabase.auth.signOut(); } catch (_) {}
}

// ─── MEDIA (Supabase Storage bucket "media") ───

// Uploads a Blob to <my id>/<kind>/<random>.<ext> and returns its public URL.
export async function uploadMedia(blob, kind, ext, contentType) {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");
  const name = `${user.id}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await withTimeout(
    supabase.storage.from("media").upload(name, blob, { contentType, upsert: false, cacheControl: "31536000" }),
    60000
  );
  if (error) throw new Error(error.message);
  return supabase.storage.from("media").getPublicUrl(name).data.publicUrl;
}

export async function unmatch(matchId) {
  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) throw new Error(error.message);
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
  return data;
}

// ─── PUSH NOTIFICATIONS ───

export async function savePushSubscription(sub) {
  const user = await currentUser();
  if (!user) return;
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys?.p256dh, auth: sub.keys?.auth, user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: "endpoint" }
  );
  if (error) throw new Error(error.message);
}

export async function deletePushSubscription(endpoint) {
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function sendTestPush() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const resp = await fetch("https://ksscosugtbdzgekrszck.supabase.co/functions/v1/send-push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ userId: session.user.id, title: "Agape test", body: "Notifications are working.", url: "/?tab=profile", tag: "test" }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `Server error ${resp.status}`);
  return data;
}

// Fire-and-forget: a failed push must never break the action that triggered it
export function notifyUser(userId, { title, body, url, tag }) {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session || !userId) return;
    return fetch("https://ksscosugtbdzgekrszck.supabase.co/functions/v1/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ userId, title, body, url, tag }),
    });
  }).catch(() => {});
}

// ─── DATE FEEDBACK (showed up / no-show) ───

export async function getReliability(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await supabase.rpc("reliability_for", { p_ids: unique });
  if (!error) return Object.fromEntries((data || []).map((r) => [r.user_id, { dates: r.dates, noShows: r.no_shows }]));
  // Before security_hardening.sql has run, the rows are still readable directly
  const { data: rows, error: rowErr } = await supabase.from("date_feedback").select("to_user, showed_up").in("to_user", unique);
  if (rowErr) return {};
  const out = {};
  for (const r of rows || []) {
    const o = out[r.to_user] || (out[r.to_user] = { dates: 0, noShows: 0 });
    o.dates += 1;
    if (!r.showed_up) o.noShows += 1;
  }
  return out;
}

export async function rateDate(invitationId, matchId, toUser, showedUp) {
  const user = await currentUser();
  const { error } = await supabase.from("date_feedback").insert({
    invitation_id: invitationId,
    match_id: matchId,
    from_user: user.id,
    to_user: toUser,
    showed_up: showedUp,
  });
  if (error) throw new Error(error.message);
}

export async function getMyDateRating(invitationId) {
  const user = await currentUser();
  const { data, error } = await supabase
    .from("date_feedback")
    .select("showed_up")
    .eq("invitation_id", invitationId)
    .eq("from_user", user.id)
    .maybeSingle();
  if (error) return null;
  return data || null;
}

export const CANCELLED_BY_SENDER = "Cancelled by sender";

// The status column only allows pending/responded/confirmed/declined, so a cancel is a self-decline with a marker
export async function cancelDate(invitationId) {
  const { data, error } = await supabase
    .from("date_invitations")
    .update({ status: "declined", decline_reasons: [CANCELLED_BY_SENDER] })
    .eq("id", invitationId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export const isCancelledInvite = (inv) => inv?.status === "declined" && (inv.decline_reasons || []).includes(CANCELLED_BY_SENDER);

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
    details: p.details || {},
    bio: p.bio || "",
    doves: p.doves ?? 3,
    filters: p.filters || { minAge: 18, maxAge: 50, maxDistance: 80, denomination: "" },
    isActive: p.is_active,
    lastActive: p.last_active,
    subscriptionStatus: p.subscription_status || "none",
    notificationPrefs: p.notification_prefs || {},
    paused: !!p.paused,
  };
}

// ─── PHOTOS ───

// Originals live in their own table (aligned by index with profiles.photos) so Seek never downloads them
export async function getPhotoOriginals() {
  const user = await currentUser();
  if (!user) return [];
  const { data } = await supabase.from("photo_originals").select("originals").eq("user_id", user.id).maybeSingle();
  return Array.isArray(data?.originals) ? data.originals : [];
}

export async function savePhotoOriginals(originals) {
  const user = await currentUser();
  if (!user) return;
  const { error } = await supabase
    .from("photo_originals")
    .upsert({ user_id: user.id, originals, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export function downscaleDataUrl(src, max = 1600, quality = 0.85) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      if (ratio === 1 && src.startsWith("data:image/jpeg")) return resolve(src);
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * ratio);
      c.height = Math.round(img.naturalHeight * ratio);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

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
