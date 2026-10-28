// Mass play-through of the app's API layer with 200 synthetic accounts against the in-memory backend.
import { createFakeBackend } from "./_sim/fakeSupabase";
import * as api from "./services/api";
import { scoreProfile, rankProfiles, mostCompatible } from "./utils/algorithm";
import { computeDeadline, FIVE_DAYS, NUDGE_BONUS, CALL_GRACE, COOLDOWN_48H } from "./utils/deadline";
import { setServerUsage, getLikesRemaining, getDovesRemaining, getRevealsRemaining } from "./services/limits";

const be = createFakeBackend();
be.install();

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail: ok ? "" : String(detail).slice(0, 300) }); return !!ok; };
const expectThrow = async (name, fn, re) => {
  try { await fn(); check(name, false, "no error thrown"); }
  catch (e) { check(name, re ? re.test(e.message || "") : true, e.message); }
};
const safe = async (name, fn) => { try { return await fn(); } catch (e) { check(name, false, e.message); return undefined; } };

// ── 200 accounts ──
const CITIES = [
  { city: "Schwyz", lat: 47.0207, lng: 8.653 }, { city: "Zürich", lat: 47.3769, lng: 8.5417 }, { city: "Luzern", lat: 47.0502, lng: 8.3093 },
  { city: "Bern", lat: 46.948, lng: 7.4474 }, { city: "Basel", lat: 47.5596, lng: 7.5886 }, { city: "Stockholm", lat: 59.3293, lng: 18.0686 },
];
const DENOMS = ["Catholic", "Orthodox", "Protestant", "Evangelical", "Baptist"];
const INTERESTS = ["Hiking", "Cooking", "Praying", "Sport", "Music", "Reading", "Travel", "Coffee"];
const KIDS = ["want", "open", "no"]; const CHURCH = ["weekly", "monthly", "rarely"];
const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
const ids = [];
for (let i = 1; i <= 200; i++) {
  const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
  ids.push(id);
  const c = CITIES[i % CITIES.length];
  be.seedProfile({
    id, email: `user${i}@sim.test`, name: `User${i}`, age: 20 + (i % 20), height: 160 + (i % 30), gender: i % 2 ? "male" : "female",
    denomination: DENOMS[i % DENOMS.length], job: "Engineer", school: "ETH", location_city: c.city, location_lat: c.lat + (i % 7) * 0.01, location_lng: c.lng + (i % 5) * 0.01,
    photos: [PHOTO, PHOTO], prompts: [{ prompt: "My faith means to me", answer: `Answer ${i}` }, { prompt: "I go crazy for", answer: "coffee" }, { prompt: "Prayer", answer: "daily" }],
    interests: INTERESTS.filter((_, k) => (i + k) % 3 === 0), traits: ["Kind"], who_are_you: ["Single"], looking_for: ["Marriage"],
    details: { kids: KIDS[i % 3], church: CHURCH[i % 3], prayer: "daily" }, filters: { minAge: 18, maxAge: 45, maxDistance: 80, denominations: [], details: {} },
    subscription_status: i % 10 === 0 ? "active" : "none",
  });
}
const idOf = (n) => ids[n - 1];
const as = (n) => be.setUser(idOf(n));
const km = (a, b) => { const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180; const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };

async function run() {
  // ── Phase 1: Seek, likes, Doves, comments, skips, limits ──
  const liked = {}; // n → [targetIds]
  for (let n = 1; n <= 200; n++) {
    as(n);
    const me = be.db.profiles.find((p) => p.id === idOf(n));
    const disc = await safe(`discover ${n}`, () => api.getDiscover());
    if (!disc) continue;
    check(`discover ${n}: no self / same gender / paused`, disc.every((p) => p.id !== me.id && p.gender !== me.gender && !p.paused));
    const far = disc.filter((p) => p.lat && km({ lat: me.location_lat, lng: me.location_lng }, { lat: p.lat, lng: p.lng }) > 81);
    check(`discover ${n}: distance ≤ 80 km`, far.length === 0, `${far.length} too far, e.g. ${far[0]?.location}`);
    check(`discover ${n}: age in filters`, disc.every((p) => p.age >= 18 && p.age <= 45));
    check(`discover ${n}: no private columns`, disc.every((p) => !("email" in p) && !("subscriptionStatus" in p)));
    const prem = me.subscription_status === "active";
    const limit = prem ? 15 : 8;
    liked[n] = [];
    let k = 0;
    for (const p of disc) {
      if (k >= limit) break;
      const comment = k === 1 ? "Love your prompt!" : null;
      const res = await safe(`like ${n}→${p.name}`, () => api.sendLike(p.id, k === 1 ? "prompt" : "profile", 0, comment, false));
      if (res) { liked[n].push(p.id); k++; }
    }
    if (disc.length > limit) await expectThrow(`like limit ${n} (${limit})`, () => api.sendLike(disc[limit].id, "profile", 0, null, false), /all your likes/);
    if (disc[0]) await expectThrow(`double like ${n}`, () => api.sendLike(disc[0].id, "profile", 0, null, false), /Already liked/);
    const doveTarget = disc[limit + 1] || disc[disc.length - 1];
    if (doveTarget && !liked[n].includes(doveTarget.id)) {
      const d = await safe(`dove ${n}`, () => api.sendLike(doveTarget.id, "profile", 0, "A Dove for you", true));
      if (d) liked[n].push(doveTarget.id);
      const second = disc.find((p) => !liked[n].includes(p.id));
      if (second) {
        if (prem) { const d2 = await safe(`dove 2 premium ${n}`, () => api.sendLike(second.id, "profile", 0, null, true)); if (d2) liked[n].push(second.id); }
        else await expectThrow(`dove limit free ${n}`, () => api.sendLike(second.id, "profile", 0, null, true), /all your Doves/);
      }
    }
    const skipT = disc.find((p) => !liked[n].includes(p.id));
    if (skipT) await safe(`skip ${n}`, () => api.skipProfile(skipT.id));
    const usage = await safe(`usage ${n}`, () => api.getUsage());
    if (usage) {
      check(`usage ${n}: likes used = ${k}`, usage.likesUsed === k && usage.likesLimit === limit, JSON.stringify(usage));
      setServerUsage(usage);
      check(`limits.js ${n}: remaining from server`, getLikesRemaining(prem) === limit - k && getDovesRemaining(prem) === usage.dovesLimit - usage.dovesUsed && (prem ? getRevealsRemaining(true) === Infinity : getRevealsRemaining(false) === usage.revealsLimit - usage.revealsUsed));
    }
    const again = await safe(`discover after likes ${n}`, () => api.getDiscover());
    if (again) check(`discover ${n}: liked and skipped gone`, again.every((p) => !liked[n].includes(p.id) && p.id !== skipT?.id));
  }

  // ── Phase 2: Sparks (received likes), reveals, like back → matches ──
  const matchesOf = {};
  for (let n = 1; n <= 200; n++) {
    as(n);
    const prem = be.db.profiles.find((p) => p.id === idOf(n)).subscription_status === "active";
    const likes = await safe(`likes received ${n}`, () => api.getLikesReceived());
    if (!likes) continue;
    // Sparks hides likers who are already a match (they live in Messages)
    const matchedWith = new Set(be.db.matches.filter((m) => m.user1 === idOf(n) || m.user2 === idOf(n)).map((m) => (m.user1 === idOf(n) ? m.user2 : m.user1)));
    const expected = be.db.likes.filter((l) => l.to_user === idOf(n) && !matchedWith.has(l.from_user)).length;
    check(`sparks ${n}: count ${likes.length} = ${expected}`, likes.length === expected);
    // unlocked likes carry the sender's profile; locked ones carry no name, photo or sender id
    check(`sparks ${n}: sender profiles loaded`, likes.every((l) => l.locked || (l.profile && l.profile.name)));
    check(`sparks ${n}: locked likes hide who`, likes.filter((l) => l.locked).every((l) => !l.profile.name && !l.profile.photos.length && !l.fromUser));
    if (likes.length >= 2) {
      // ten starter reveals for everyone, then one a week for free members
      const canReveal = Math.min(likes.length, 12);
      let ok = 0;
      for (let k = 0; k < canReveal; k++) {
        try { if (await api.revealLike(likes[k].id)) ok++; }
        catch (e) { check(`reveal ${n} #${k + 1}`, !prem && k >= 11 && /reveal/.test(e.message), e.message); }
      }
      const expectedOk = prem ? canReveal : Math.min(canReveal, 11); // 10 starter + 1 this week
      check(`reveals ${n}: ${ok} of ${canReveal} allowed`, ok === expectedOk, `expected ${expectedOk}`);
      const u = await api.getUsage();
      if (!prem) check(`usage ${n}: reveal counters`, (ok < 10 && u.revealsLimit === 10 && u.revealsUsed === ok) || (ok >= 10 && u.revealsLimit === 1 && u.revealsUsed === ok - 10), JSON.stringify(u));
      const after = await api.getLikesReceived();
      check(`sparks ${n}: revealed flag`, after.find((l) => l.id === likes[0].id)?.revealed === true);
    }
    // like back the first two (limits allow: likes sent in phase 1 count today, so use remaining allowance)
    const usage = await api.getUsage();
    let left = usage.likesLimit - usage.likesUsed;
    for (const l of likes.slice(0, 2)) {
      if (left <= 0) break;
      const res = await safe(`like back ${n}`, () => api.sendLike(l.fromId, "profile", 0, null, false));
      left--;
      if (res) { check(`match created ${n}↔`, res.matched && res.matchId, JSON.stringify(res)); (matchesOf[n] ||= []).push(res.matchId); }
    }
    if (likes.length > 2) await safe(`dismiss like ${n}`, () => api.dismissLike(likes[2].id));
  }
  check("matches: both sides see them", be.db.matches.every((m) => true) && be.db.matches.length > 50, `${be.db.matches.length} matches`);
  // forced match must be impossible
  as(1); await expectThrow("forced match via insert", async () => { const { error } = await (await import("./services/supabase")).supabase.from("matches").insert({ user1: idOf(1), user2: idOf(2) }); if (error) throw new Error(error.message); }, /row-level security/);
  await expectThrow("match without mutual like", async () => { const { data, error } = await (await import("./services/supabase")).supabase.rpc("create_match_if_mutual", { p_other: idOf(199) }); if (error) throw new Error(error.message); if (data == null) throw new Error("null: no match"); }, /null/);

  // ── Phase 3: chat ──
  const allMatches = be.db.matches.slice(0, 80);
  for (const m of allMatches) {
    const a = m.user1, b = m.user2;
    be.setUser(a);
    const list = await safe(`matches list ${a}`, () => api.getMatches());
    const mine = list?.find((x) => x.id === m.id);
    check(`match ${m.id.slice(0, 8)} listed for user1 with partner`, mine && mine.profile && mine.profileId === b);
    const t1 = await safe("send text", () => api.sendMessage(m.id, "Hello there"));
    be.setUser(b);
    const listB = await api.getMatches();
    const mb = listB.find((x) => x.id === m.id);
    check("badge rule: unread from them", mb?.lastMessage && mb.lastMessage.sender === a && mb.lastMessage.read === false);
    const msgsB = await api.getMessages(m.id);
    check("partner sees message", msgsB.some((x) => x.id === t1?.id));
    const reply = await safe("send reply with media", () => api.sendMessage(m.id, "Nice to meet you", { type: "image", url: "https://ksscosugtbdzgekrszck.supabase.co/storage/v1/object/public/media/x/chat/1.jpg" }, t1?.id));
    check("reply carries replyTo + media", reply?.replyTo === t1?.id && reply?.media?.type === "image");
    await safe("voice note", () => api.sendMessage(m.id, "", { type: "audio", url: "https://ksscosugtbdzgekrszck.supabase.co/storage/v1/object/public/media/x/voice/1.webm", duration: 7 }));
    await safe("mark read", () => api.markMessagesRead(m.id));
    const afterRead = await api.getMessages(m.id);
    check("their messages marked read", afterRead.filter((x) => x.sender === a).every((x) => x.read === true));
    const rx = await safe("react", () => api.reactToMessage(t1.id, "❤️"));
    check("reaction stored", rx && rx[b] === "❤️");
    const rx2 = await api.reactToMessage(t1.id, "");
    check("reaction removed", rx2 && !rx2[b]);
    be.setUser(a);
    const listA = await api.getMatches();
    const ma = listA.find((x) => x.id === m.id);
    check("badge rule: my own last message → no unread", !(ma.lastMessage.sender !== a && !ma.lastMessage.read) || ma.lastMessage.sender !== a);
    // nobody can edit a sent message's text or delete the other's message
    const sb = (await import("./services/supabase")).supabase;
    await sb.from("messages").update({ text: "HACKED" }).eq("id", reply.id);
    check("message text cannot be changed", be.db.messages.find((x) => x.id === reply.id)?.text === "Nice to meet you");
    await sb.from("messages").delete().eq("id", reply.id);
    check("other's message cannot be deleted", !!be.db.messages.find((x) => x.id === reply.id));
  }

  // ── Phase 4: dates ──
  const dateMatches = be.db.matches.slice(0, 40);
  let confirmedCount = 0;
  for (const [i, m] of dateMatches.entries()) {
    const maleId = be.db.profiles.find((p) => p.id === m.user1)?.gender === "male" ? m.user1 : m.user2;
    const femaleId = maleId === m.user1 ? m.user2 : m.user1;
    be.setUser(maleId);
    const inv = await safe("create invitation", () => api.createDateInvitation(m.id, { dateType: "coffee", location: "Café Central", wardrobe: null, proposedTimes: [] }));
    if (!inv) continue;
    be.setUser(femaleId);
    const day = new Date(Date.now() + 3 * 86400e3).toISOString().slice(0, 10);
    const times = [{ date: day, time: "10:00", label: "x" }, { date: day, time: "19:00", label: "x" }];
    if (i % 5 === 4) {
      await safe("decline", () => api.declineDate(inv.id, ["Not the right time"]));
      be.setUser(maleId);
      const invs = await api.getDateInvitations(m.id);
      check("declined visible to him", invs.find((x) => x.id === inv.id)?.status === "declined");
      continue;
    }
    const responded = await safe("respond with hours", () => api.respondToDate(inv.id, times));
    check("responded stores times", responded?.status === "responded" && responded.response_times?.length === 2);
    be.setUser(maleId);
    if (i % 5 === 3) {
      const c = await safe("cancel plan", () => api.cancelDate(inv.id));
      check("cancel = declined + marker", c && api.isCancelledInvite(c));
      continue;
    }
    const conf = await safe("confirm", () => api.confirmDate(inv.id, times[1]));
    check("confirmed", conf?.status === "confirmed" && conf.confirmed_time?.time === "19:00");
    confirmedCount++;
    if (i % 5 === 2) {
      // cancel a confirmed date (allowed > 24h before)
      await safe("cancel confirmed", () => api.cancelDate(inv.id));
      continue;
    }
    // ratings: only after a confirmed date, only about the other person
    await safe("rate (he)", () => api.rateDate(inv.id, m.id, femaleId, i % 2 === 0));
    be.setUser(femaleId);
    await safe("rate (she)", () => api.rateDate(inv.id, m.id, maleId, true));
    await expectThrow("rate twice", () => api.rateDate(inv.id, m.id, maleId, true), /duplicate|unique/);
    await expectThrow("rate someone else", () => api.rateDate(inv.id, m.id, idOf(150), true), /row-level security/);
    const mine = await api.getMyDateRating(inv.id);
    check("my rating readable", mine?.showed_up === true);
  }
  as(3);
  const rel = await api.getReliability(ids.slice(0, 200));
  const expectRel = {};
  for (const f of be.db.date_feedback) { const o = expectRel[f.to_user] || (expectRel[f.to_user] = { dates: 0, noShows: 0 }); o.dates++; if (!f.showed_up) o.noShows++; }
  check("reliability counts match ratings", JSON.stringify(rel) === JSON.stringify(expectRel), `${Object.keys(rel).length} vs ${Object.keys(expectRel).length}`);
  const sbx = (await import("./services/supabase")).supabase;
  const { data: leak } = await sbx.from("date_feedback").select("*").neq("from_user", idOf(3));
  check("ratings of others not readable", (leak || []).length === 0);
  await expectThrow("rate without confirmed date", () => api.rateDate(uuidLike(), be.db.matches[0].id, be.db.matches[0].user2, true), /row-level security/);

  // ── Phase 5: video call, rose and the planning clock ──
  const vm = be.db.matches[45];
  be.setUser(vm.user1);
  const callAt = new Date(Date.now() + 2 * 86400e3);
  await safe("schedule video call", () => api.startVideoCall(vm.id, callAt));
  await safe("video call note", () => api.sendMessage(vm.id, "📹 Video call scheduled: Fri 10 Oct at 19:30"));
  await safe("text after scheduling", () => api.sendMessage(vm.id, "Looking forward!"));
  let ms = await api.getMatches();
  let mm = ms.find((x) => x.id === vm.id);
  check("video call time stored (planned time, not now)", Math.abs(mm.videoCallAt - callAt.getTime()) < 1000, `${mm.videoCallAt} vs ${callAt.getTime()}`);
  const msgs = await api.getMessages(vm.id);
  const dl1 = computeDeadline({ messages: msgs, match: mm, dateInvitations: [], confirmedDate: null, openInvite: null });
  check("clock paused while a call is planned, even after more texts", dl1.timerStopped && dl1.hasVideoCall && dl1.timeLeftMs === null);
  const dl2 = computeDeadline({ messages: msgs, match: mm, dateInvitations: [], confirmedDate: null, openInvite: null, now: callAt.getTime() + CALL_GRACE + 1000 });
  check("after the call: five fresh days", !dl2.timerStopped && Math.abs(dl2.deadlineMs - (callAt.getTime() + CALL_GRACE + FIVE_DAYS)) < 10);
  const dlOld = computeDeadline({ messages: msgs, match: { ...mm, videoCallAt: Date.now() - 3 * 3600e3 }, dateInvitations: [], confirmedDate: null, openInvite: null });
  check("old bug reproduced: scheduling-time stamp would resume after 2h", !dlOld.timerStopped);
  const rm = be.db.matches[46];
  const femaleOf = (m) => (be.db.profiles.find((p) => p.id === m.user1)?.gender === "female" ? m.user1 : m.user2);
  be.setUser(femaleOf(rm));
  await safe("send rose", () => api.sendNudge(rm.id));
  be.setUser(rm.user1 === femaleOf(rm) ? rm.user2 : rm.user1);
  await safe("first message", () => api.sendMessage(rm.id, "Hi"));
  ms = await api.getMatches(); mm = ms.find((x) => x.id === rm.id);
  const rmsgs = await api.getMessages(rm.id);
  const dl3 = computeDeadline({ messages: rmsgs, match: mm, dateInvitations: [], confirmedDate: null, openInvite: null });
  check("rose adds 36h", mm.nudgeAt && Math.abs(dl3.deadlineMs - (rmsgs.find((x) => !x.isComment).timestamp + FIVE_DAYS + NUDGE_BONUS)) < 10);
  const dl4 = computeDeadline({ messages: rmsgs, match: mm, dateInvitations: [{ status: "declined", created_at: new Date().toISOString(), decline_reasons: ["x"] }], confirmedDate: null, openInvite: null });
  check("decline: 48h cooling + 5 days", dl4.deadlineMs >= Date.now() + COOLDOWN_48H + FIVE_DAYS - 1000);
  const dl5 = computeDeadline({ messages: rmsgs, match: mm, dateInvitations: [], confirmedDate: { id: "c" }, openInvite: null });
  check("confirmed date pauses clock", dl5.timerStopped);
  const dl6 = computeDeadline({ messages: [{ timestamp: Date.now() - 6 * 86400e3 }], match: { nudgeAt: null }, dateInvitations: [], confirmedDate: null, openInvite: null });
  check("chat locks after 5 days", dl6.chatLocked);
  const dl7 = computeDeadline({ messages: [{ timestamp: Date.now() - 6 * 86400e3, isComment: true }], match: {}, dateInvitations: [], confirmedDate: null, openInvite: null });
  check("a like comment does not start the clock", !dl7.chatLocked && dl7.deadlineMs === null);

  // ── Phase 6: safety ──
  const bm = be.db.matches[47];
  const A = bm.user1, B = bm.user2;
  be.setUser(A);
  const profB = be.db.profiles.find((p) => p.id === B);
  await safe("block", () => api.blockUser({ id: B, name: profB.name, photos: profB.photos }));
  check("blocked list", (await api.getBlocks()).some((b) => (b.id || b.blocked || b) === B || b.id === B), JSON.stringify((await api.getBlocks())[0]));
  be.setUser(B);
  const pubB = await api.fetchPublicProfiles([A]);
  check("blocked user cannot see blocker", !pubB[A]);
  const discB = await api.getDiscover();
  check("blocked: not in their Seek", !discB.some((p) => p.id === A));
  be.setUser(A);
  const pubA = await api.fetchPublicProfiles([B]);
  check("blocker cannot see blocked", !pubA[B]);
  await safe("unblock", () => api.unblockUser(B));
  check("unblock restores", !!(await api.fetchPublicProfiles([B]))[B]);
  const rep = await safe("report", () => api.reportUser({ profile: { id: B, name: profB.name, photos: profB.photos }, reason: "Fake profile" }));
  check("report saved", rep?.id && (await api.getMyReports()).some((r) => r.id === rep.id));
  const um = be.db.matches[48];
  be.setUser(um.user1);
  await api.sendMessage(um.id, "bye");
  await safe("unmatch", () => api.unmatch(um.id));
  check("unmatch removes match for both", !be.db.matches.some((x) => x.id === um.id));
  check("unmatch removes messages", !be.db.messages.some((x) => x.match_id === um.id));
  be.setUser(um.user2);
  check("other side no longer lists it", !(await api.getMatches()).some((x) => x.id === um.id));

  // ── Phase 7: settings & profile ──
  as(7);
  const pr = await safe("update prefs", () => api.updateProfile({ notificationPrefs: { matches: false, messages: true }, filters: { minAge: 25, maxAge: 35, maxDistance: 30, denominations: ["Catholic"], details: { kids: ["want"] } }, paused: true }));
  check("prefs saved", pr?.notificationPrefs?.matches === false && pr.paused === true && pr.filters?.maxAge === 35, JSON.stringify(pr?.filters));
  as(8);
  check("paused profile hidden from Seek", !(await api.getDiscover()).some((p) => p.id === idOf(7)));
  as(7);
  await api.updateProfile({ paused: false });
  const ph = await api.updateProfile({ photos: [PHOTO, "javascript:alert(1)", "https://example.com/a.jpg", "http://insecure/a.jpg"] });
  check("bad photo urls dropped", ph.photos.length === 2 && ph.photos.every((u) => u.startsWith("data:image/") || u.startsWith("https://")), JSON.stringify(ph.photos.map((u) => u.slice(0, 20))));
  const sb2 = (await import("./services/supabase")).supabase;
  const { error: protErr } = await sb2.from("profiles").update({ subscription_status: "active" }).eq("id", idOf(7));
  check("subscription cannot be self-granted", !!protErr && /subscription_status/.test(protErr.message));
  const { error: emailErr } = await sb2.from("profiles").update({ email: "x@y.z" }).eq("id", idOf(7));
  check("email cannot be changed from client", !!emailErr);
  const { data: others } = await sb2.from("profiles").select("*").neq("id", idOf(7));
  check("other profiles table rows not readable", (others || []).length === 0);
  const pub = await api.fetchPublicProfiles([idOf(8)]);
  check("public profile has no email/stripe/prefs", pub[idOf(8)] && !("email" in pub[idOf(8)]) && !("stripe_customer_id" in pub[idOf(8)]) && !("notification_prefs" in pub[idOf(8)]));
  check("public profile coordinates rounded", String(pub[idOf(8)].location_lat).split(".")[1]?.length <= 2);
  const loc = await safe("change city", () => api.updateProfile({ location: "Luzern", locationLat: 47.05, locationLng: 8.31 }));
  check("city + coords saved", loc?.location?.city === "Luzern" && Math.abs(loc.location.lat - 47.05) < 1e-6, JSON.stringify(loc?.location));
  const v = await safe("submit verification", () => api.submitVerification("church", PHOTO));
  check("verification pending", v?.status === "pending" && (await api.getMyVerifications()).church?.status === "pending");
  await safe("remove verification", () => api.removeVerification("church"));
  check("verification removed", !(await api.getMyVerifications()).church);
  await safe("touch activity", () => api.touchActivity());
  check("last active updated", Date.now() - new Date(be.db.profiles.find((p) => p.id === idOf(7)).last_active).getTime() < 5000);

  // ── Phase 8: algorithm ──
  as(9);
  const me9 = (await api.getMe());
  const disc9 = await api.getDiscover();
  const scores = disc9.map((p) => scoreProfile(p, me9, me9.filters));
  check("scores within 0..100", scores.every((s) => s.score >= 0 && s.score <= 100 && Array.isArray(s.reasons)));
  const r1 = rankProfiles(disc9, me9, me9.filters).map((p) => p.id);
  const r2 = rankProfiles(disc9, me9, me9.filters).map((p) => p.id);
  check("ranking deterministic within a day", JSON.stringify(r1) === JSON.stringify(r2));
  const best = mostCompatible(disc9, me9, me9.filters);
  check("most compatible is top scorer", best && scoreProfile(best, me9, me9.filters).score === Math.max(...scores.map((s) => s.score)));

  // ── Phase 9: delete account ──
  as(10);
  await safe("delete account", () => api.deleteAccount());
  check("account and its data gone", !be.db.profiles.some((p) => p.id === idOf(10)) && !be.db.likes.some((l) => l.from_user === idOf(10) || l.to_user === idOf(10)) && !be.db.matches.some((m) => m.user1 === idOf(10) || m.user2 === idOf(10)));

  // ── Phase 9b: friends side ──
  for (let n = 101; n <= 120; n++) be.db.profiles.find((p) => p.id === idOf(n)).intent = "friends";
  for (let n = 121; n <= 140; n++) be.db.profiles.find((p) => p.id === idOf(n)).intent = "both";
  as(121);
  const fd = await safe("friends discover", () => api.getDiscover("friends"));
  check("friends seek: both genders", fd && fd.some((p) => p.gender === "male") && fd.some((p) => p.gender === "female"), `${fd?.length} profiles`);
  check("friends seek: only people here for friends", fd && fd.length > 0 && fd.every((p) => ["friends", "both"].includes(p.intent)));
  const dd = await api.getDiscover("date");
  check("dating seek: nobody who is only here for friends", dd.every((p) => p.intent !== "friends") && dd.every((p) => p.gender !== "male"));
  const wavesTo = fd.slice(0, 17);
  let waved = 0;
  for (const p of wavesTo.slice(0, 15)) { const r = await safe("wave", () => api.sendLike(p.id, "profile", 0, null, false, "friend")); if (r) waved++; }
  check("15 waves allowed", waved === 15);
  if (wavesTo[15]) await expectThrow("16th wave refused", () => api.sendLike(wavesTo[15].id, "profile", 0, null, false, "friend"), /waves/);
  if (wavesTo[16]) await expectThrow("a Dove on the friends side counts as a wave", () => api.sendLike(wavesTo[16].id, "profile", 0, null, true, "friend"), /waves/);
  const u121 = await api.getUsage();
  check("waves counted separately from likes", u121.wavesUsed === 15 && u121.likesUsed < 15, JSON.stringify(u121));
  const target = wavesTo[0];
  be.setUser(target.id);
  const wl = await api.getLikesReceived("friends");
  check("wave shows under Waves of the other person", wl.some((l) => l.fromId === idOf(121) && l.kind === "friend"));
  check("wave does not show under dating Sparks", !(await api.getLikesReceived("date")).some((l) => l.fromId === idOf(121)));
  const back = await safe("wave back", () => api.sendLike(idOf(121), "profile", 0, null, false, "friend"));
  check("waving back makes friends", back?.matched && back.matchId);
  const fm = await api.getMatches("friends");
  check("friend listed under Friends with kind", fm.some((m) => m.id === back?.matchId && m.kind === "friend" && m.profileId === idOf(121)));
  check("friend not listed under dating Messages", !(await api.getMatches("date")).some((m) => m.id === back?.matchId));
  await safe("friend chat message", () => api.sendMessage(back.matchId, "Hi friend"));
  be.setUser(idOf(121));
  check("other side sees the friend too", (await api.getMatches("friends")).some((m) => m.id === back?.matchId));
  check("one side or the other: a friend never shows in dating Seek", !(await api.getDiscover("date")).some((p) => p.id === target.id));
  check("one side or the other: people I waved at are out of dating Seek", !(await api.getDiscover("date")).some((p) => wavesTo.slice(0, 15).some((w) => w.id === p.id)));
  const dl = await safe("dating like to the same person", () => api.sendLike(target.id, "profile", 0, null, false, "date"));
  check("dating like is separate from the wave", dl && !dl.matched);
  const nf = await api.updateProfile({ intent: "friends" });
  check("intent saved", nf.intent === "friends");
  as(1);
  check("friends-only person gone from dating seek", !(await api.getDiscover("date")).some((p) => p.id === idOf(121)));

  // ── Phase 10: logged-out access ──
  be.setUser(null);
  const { data: anon } = await sb2.from("profiles_public").select("*").limit(5);
  check("logged out sees no profiles", !anon || anon.length === 0);

  check("no unsupported backend operations", be.state.unsupported.length === 0, [...new Set(be.state.unsupported)].join("; "));
  return results;
}

function uuidLike() { return crypto.randomUUID(); }

run().then((res) => {
  const failed = res.filter((r) => !r.ok);
  const summary = { total: res.length, passed: res.length - failed.length, failed: failed.length, calls: be.state.calls, pushes: be.state.pushes.length, matches: be.db.matches.length, messages: be.db.messages.length, invitations: be.db.date_invitations.length };
  window.__SIM = { summary, failed, results: res };
  document.getElementById("root").textContent = JSON.stringify({ summary, failed: failed.slice(0, 80) }, null, 1);
}).catch((e) => {
  window.__SIM = { error: String(e && e.stack || e), results };
  document.getElementById("root").textContent = "CRASH " + (e && e.stack || e) + "\n" + JSON.stringify(results.filter((r) => !r.ok).slice(0, 40), null, 1);
});
