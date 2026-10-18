// An in-memory stand-in for the Supabase backend: PostgREST-style tables with the app's own
// row-level rules, triggers and functions, so the whole API layer can be exercised without a server.
import { supabase } from "../services/supabase";

const uuid = () => crypto.randomUUID();
const TABLES = ["profiles", "likes", "skips", "matches", "messages", "date_invitations", "date_feedback", "blocks", "reports", "photo_verifications", "spark_reveals", "push_subscriptions", "photo_originals", "community_posts", "community_replies", "community_amens"];
const PUBLIC_PROFILE_COLS = ["id", "name", "age", "height", "gender", "denomination", "job", "school", "location_city", "location_lat", "location_lng", "photos", "prompts", "interests", "traits", "who_are_you", "looking_for", "bio", "filters", "is_active", "is_standout", "compatibility_reason", "verified_photos", "details", "paused", "last_active", "created_at", "intent", "community_points"];
const PROTECTED = ["subscription_status", "doves", "is_active", "stripe_customer_id", "subscription_id", "is_standout", "email"];

export function createFakeBackend() {
  const db = Object.fromEntries(TABLES.map((t) => [t, []]));
  const state = { cur: null, offset: 0, unsupported: [], calls: 0, pushes: [], deleted: [] };
  const now = () => Date.now() + state.offset;
  const nowIso = () => new Date(now()).toISOString();
  const json = (status, body) => (status === 204 ? new Response(null, { status }) : new Response(body === undefined ? "" : JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  const err = (status, code, message, details = null) => json(status, { code, message, details, hint: null });

  const blockedEither = (a, b) => db.blocks.some((x) => (x.blocker === a && x.blocked === b) || (x.blocker === b && x.blocked === a));
  const participant = (matchId, uid) => db.matches.some((m) => m.id === matchId && (m.user1 === uid || m.user2 === uid));
  const profileOf = (id) => db.profiles.find((p) => p.id === id);
  const premium = (id) => profileOf(id)?.subscription_status === "active";
  const dayStart = () => { const d = new Date(now()); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };
  const weekStart = () => { const d = new Date(now()); d.setUTCHours(0, 0, 0, 0); const wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd); return d.getTime(); };
  const ts = (iso) => new Date(iso).getTime();

  // ── filters ──
  const parseValue = (v) => (v === "null" ? null : v);
  const cmp = (a, b) => {
    const na = Number(a), nb = Number(b);
    if (a !== "" && b !== "" && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  };
  const evalCond = (row, key, cond) => {
    if (cond.startsWith("not.")) return !evalCond(row, key, cond.slice(4));
    const dot = cond.indexOf(".");
    const op = dot === -1 ? cond : cond.slice(0, dot);
    const val = dot === -1 ? "" : cond.slice(dot + 1);
    const cell = row[key];
    switch (op) {
      case "eq": return cell != null && String(cell) === val;
      case "neq": return cell == null || String(cell) !== val;
      case "gt": return cell != null && cmp(cell, val) > 0;
      case "gte": return cell != null && cmp(cell, val) >= 0;
      case "lt": return cell != null && cmp(cell, val) < 0;
      case "lte": return cell != null && cmp(cell, val) <= 0;
      case "is": return val === "null" ? cell == null : String(cell) === val;
      case "in": {
        const list = val.replace(/^\(|\)$/g, "").split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
        return cell != null && list.includes(String(cell));
      }
      case "like": case "ilike": {
        const re = new RegExp("^" + val.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/\*/g, ".*") + "$", op === "ilike" ? "i" : "");
        return re.test(String(cell ?? ""));
      }
      default: state.unsupported.push(`filter op ${op}`); return true;
    }
  };
  // "(a.eq.x,and(b.eq.y,c.eq.z))" → boolean for the row
  const splitTop = (s) => { const out = []; let depth = 0, cur = ""; for (const ch of s) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch; } if (cur) out.push(cur); return out; };
  const evalLogic = (row, expr, mode = "or") => {
    const inner = expr.startsWith("(") ? expr.slice(1, -1) : expr;
    const parts = splitTop(inner).map((p) => p.trim());
    const results = parts.map((p) => {
      if (p.startsWith("and(")) return evalLogic(row, p.slice(3), "and");
      if (p.startsWith("or(")) return evalLogic(row, p.slice(2), "or");
      const dot = p.indexOf(".");
      return evalCond(row, p.slice(0, dot), p.slice(dot + 1));
    });
    return mode === "and" ? results.every(Boolean) : results.some(Boolean);
  };
  const applyQuery = (rows, params) => {
    let out = rows.filter((row) => {
      for (const [key, cond] of params.entries()) {
        if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(key)) continue;
        if (key === "or") { if (!evalLogic(row, cond, "or")) return false; continue; }
        if (key === "and") { if (!evalLogic(row, cond, "and")) return false; continue; }
        if (!evalCond(row, key, cond)) return false;
      }
      return true;
    });
    const order = params.get("order");
    if (order) {
      for (const part of order.split(",").reverse()) {
        const [col, dir] = part.split(".");
        out = [...out].sort((a, b) => (dir === "desc" ? -1 : 1) * cmp(a[col] ?? "", b[col] ?? ""));
      }
    }
    const offset = Number(params.get("offset") || 0);
    const limit = params.get("limit") != null ? Number(params.get("limit")) : Infinity;
    return out.slice(offset, offset + limit);
  };

  // ── what the signed-in person may see ──
  const visibleRows = (table) => {
    const u = state.cur?.id;
    if (!u) return [];
    switch (table) {
      case "profiles": return db.profiles.filter((p) => p.id === u);
      case "profiles_public": return db.profiles.filter((p) => p.is_active && !blockedEither(u, p.id)).map((p) => Object.fromEntries(PUBLIC_PROFILE_COLS.map((c) => [c, c === "location_lat" || c === "location_lng" ? (p[c] == null ? null : Math.round(p[c] * 100) / 100) : p[c]])));
      case "likes": return db.likes.filter((l) => l.from_user === u || l.to_user === u);
      case "skips": return db.skips.filter((s) => s.from_user === u);
      case "matches": return db.matches.filter((m) => m.user1 === u || m.user2 === u);
      case "messages": return db.messages.filter((m) => participant(m.match_id, u));
      case "date_invitations": return db.date_invitations.filter((i) => participant(i.match_id, u));
      case "date_feedback": return db.date_feedback.filter((f) => f.from_user === u);
      case "blocks": return db.blocks.filter((b) => b.blocker === u || b.blocked === u);
      case "reports": return db.reports.filter((r) => r.reporter === u);
      case "photo_verifications": return db.photo_verifications.filter((v) => v.user_id === u);
      case "spark_reveals": return db.spark_reveals.filter((r) => r.user_id === u);
      case "push_subscriptions": return db.push_subscriptions.filter((r) => r.user_id === u);
      case "photo_originals": return db.photo_originals.filter((r) => r.user_id === u);
      case "community_posts": case "community_replies": case "community_amens": return db[table];
      default: state.unsupported.push(`table ${table}`); return [];
    }
  };

  // ── inserts with the database's own checks ──
  const limitsFor = (uid) => premium(uid) ? { likes: 15, doves: 3, reveals: 1e6, waves: 30 } : { likes: 8, doves: 1, reveals: 1, waves: 15 };
  const insertRow = (table, row) => {
    const u = state.cur?.id;
    const r = { ...row };
    if (!("id" in r) || r.id == null) r.id = uuid();
    if (!("created_at" in r) || r.created_at == null) r.created_at = nowIso();
    switch (table) {
      case "profiles": {
        if (r.id !== u) throw err(401, "42501", "new row violates row-level security policy for table \"profiles\"");
        if (db.profiles.some((p) => p.email && p.email === r.email)) throw err(409, "23505", "duplicate key value violates unique constraint \"profiles_email_key\"");
        Object.assign(r, { doves: 3, is_active: true, is_standout: false, subscription_status: "none", paused: false, details: {}, verified_photos: {}, notification_prefs: {}, traits: [], who_are_you: [], looking_for: [], bio: "", last_active: nowIso(), intent: "date", ...r });
        break;
      }
      case "likes": {
        if (r.from_user !== u) throw err(401, "42501", "new row violates row-level security policy for table \"likes\"");
        r.kind = r.kind || "date";
        if (db.likes.some((l) => l.from_user === r.from_user && l.to_user === r.to_user && (l.kind || "date") === r.kind)) throw err(409, "23505", "duplicate key value violates unique constraint \"likes_from_to_kind_key\"");
        const lim = limitsFor(u);
        if (r.kind === "friend") {
          r.is_dove = false;
          const used = db.likes.filter((l) => l.from_user === u && l.kind === "friend" && ts(l.created_at) >= dayStart()).length;
          if (used >= lim.waves) throw err(400, "P0001", "WAVE_LIMIT");
        } else if (r.is_dove) {
          const used = db.likes.filter((l) => l.from_user === u && l.kind !== "friend" && l.is_dove && ts(l.created_at) >= weekStart()).length;
          if (used >= lim.doves) throw err(400, "P0001", "DOVE_LIMIT");
        } else {
          const used = db.likes.filter((l) => l.from_user === u && l.kind !== "friend" && !l.is_dove && ts(l.created_at) >= dayStart()).length;
          if (used >= lim.likes) throw err(400, "P0001", "LIKE_LIMIT");
        }
        r.is_dove = !!r.is_dove;
        break;
      }
      case "skips": if (r.from_user !== u) throw err(401, "42501", "RLS skips"); break;
      case "matches": throw err(401, "42501", "new row violates row-level security policy for table \"matches\"");
      case "messages": {
        if (r.sender !== u || !participant(r.match_id, u)) throw err(401, "42501", "new row violates row-level security policy for table \"messages\"");
        r.read = false; r.reactions = r.reactions || {};
        for (const k of ["media_type", "media_url", "media_duration", "reply_to"]) if (!(k in r)) r[k] = null;
        break;
      }
      case "date_invitations": {
        if (r.from_user !== u || !participant(r.match_id, u)) throw err(401, "42501", "RLS date_invitations");
        r.status = r.status || "pending";
        for (const k of ["response_times", "confirmed_time", "decline_reasons"]) if (!(k in r)) r[k] = null;
        break;
      }
      case "date_feedback": {
        const inv = db.date_invitations.find((i) => i.id === r.invitation_id);
        const m = db.matches.find((x) => x.id === r.match_id);
        const ok = r.from_user === u && r.from_user !== r.to_user && inv && m && inv.match_id === m.id && inv.status === "confirmed" &&
          ((m.user1 === u && m.user2 === r.to_user) || (m.user2 === u && m.user1 === r.to_user));
        if (!ok) throw err(401, "42501", "new row violates row-level security policy for table \"date_feedback\"");
        if (db.date_feedback.some((f) => f.invitation_id === r.invitation_id && f.from_user === r.from_user)) throw err(409, "23505", "duplicate key value violates unique constraint");
        break;
      }
      case "blocks": if (r.blocker !== u) throw err(401, "42501", "RLS blocks"); break;
      case "reports": if (r.reporter !== u) throw err(401, "42501", "RLS reports"); r.status = r.status || "open"; break;
      case "photo_verifications": if (r.user_id !== u) throw err(401, "42501", "RLS photo_verifications"); if (!("note" in r)) r.note = null; break;
      case "spark_reveals": {
        const like = db.likes.find((l) => l.id === r.like_id);
        if (r.user_id !== u || !like || like.to_user !== u) throw err(401, "42501", "new row violates row-level security policy for table \"spark_reveals\"");
        if (db.spark_reveals.some((x) => x.user_id === r.user_id && x.like_id === r.like_id)) throw err(409, "23505", "duplicate key value violates unique constraint \"spark_reveals_user_id_like_id_key\"");
        const mine = db.spark_reveals.filter((x) => x.user_id === u).sort((a, b) => ts(a.created_at) - ts(b.created_at));
        if (!premium(u) && mine.length >= 10) {
          const used = mine.slice(10).filter((x) => ts(x.created_at) >= weekStart()).length;
          if (used >= limitsFor(u).reveals) throw err(400, "P0001", "REVEAL_LIMIT");
        }
        break;
      }
      case "push_subscriptions": case "photo_originals": if (r.user_id !== u) throw err(401, "42501", `RLS ${table}`); break;
      case "community_posts": if (r.author !== u) throw err(401, "42501", "RLS community_posts"); Object.assign(r, { reply_count: 0, amen_count: 0, last_activity: r.created_at, category: r.category || "general" }); addPoints(r.author, 1); break;
      case "community_replies": { if (r.author !== u) throw err(401, "42501", "RLS community_replies"); const post = db.community_posts.find((p) => p.id === r.post_id); if (post) { post.reply_count++; post.last_activity = nowIso(); if (post.author !== r.author) addPoints(post.author, 3); } addPoints(r.author, 1); break; }
      case "community_amens": { if (r.user_id !== u) throw err(401, "42501", "RLS community_amens"); if (db.community_amens.some((a) => a.post_id === r.post_id && a.user_id === r.user_id)) throw err(409, "23505", "duplicate"); const post = db.community_posts.find((p) => p.id === r.post_id); if (post) { post.amen_count++; if (post.author !== r.user_id) addPoints(post.author, 2); } break; }
      default: state.unsupported.push(`insert ${table}`);
    }
    db[table].push(r);
    return r;
  };

  const addPoints = (uid, delta) => { const p = profileOf(uid); if (p) p.community_points = Math.max(0, (p.community_points || 0) + delta); };
  const upsertRow = (table, row, conflictCols) => {
    const cols = conflictCols ? conflictCols.split(",").map((c) => c.trim()) : ["id"];
    if (table === "community_amens" && db.community_amens.some((x) => x.post_id === row.post_id && x.user_id === row.user_id)) return row;
    const existing = db[table].find((x) => cols.every((c) => String(x[c]) === String(row[c])));
    if (existing) { Object.assign(existing, row); return existing; }
    return insertRow(table, row);
  };

  const updateRows = (table, rows, patch) => {
    const u = state.cur?.id;
    for (const row of rows) {
      const p = { ...patch };
      if (table === "profiles") {
        for (const k of PROTECTED) if (k in p && JSON.stringify(p[k]) !== JSON.stringify(row[k])) throw err(400, "P0001", `Cannot modify ${k} from client`);
      }
      if (table === "matches") { delete p.id; delete p.user1; delete p.user2; delete p.created_at; }
      if (table === "messages") { for (const k of Object.keys(p)) if (!["read", "reactions"].includes(k)) delete p[k]; }
      if (table === "date_invitations" && !participant(row.match_id, u)) continue;
      Object.assign(row, p);
    }
    return rows;
  };

  const deleteRows = (table, rows) => {
    const u = state.cur?.id;
    const allowed = rows.filter((row) => {
      switch (table) {
        case "likes": return row.from_user === u || row.to_user === u;
        case "skips": return row.from_user === u;
        case "matches": return row.user1 === u || row.user2 === u;
        case "messages": return row.sender === u;
        case "blocks": return row.blocker === u;
        case "photo_verifications": case "push_subscriptions": case "photo_originals": case "spark_reveals": return row.user_id === u;
        case "profiles": return row.id === u;
        case "community_posts": case "community_replies": return row.author === u;
        case "community_amens": return row.user_id === u;
        default: return false;
      }
    });
    const ids = new Set(allowed.map((r) => r.id));
    db[table] = db[table].filter((r) => !ids.has(r.id));
    if (table === "matches") {
      for (const id of ids) {
        db.messages = db.messages.filter((m) => m.match_id !== id);
        db.date_invitations = db.date_invitations.filter((i) => i.match_id !== id);
        db.date_feedback = db.date_feedback.filter((f) => f.match_id !== id);
      }
    }
    if (table === "profiles") cascadeUser([...ids]);
    if (table === "community_posts") { db.community_replies = db.community_replies.filter((r) => !ids.has(r.post_id)); db.community_amens = db.community_amens.filter((a) => !ids.has(a.post_id)); }
    if (table === "community_replies") for (const r of allowed) { const post = db.community_posts.find((p) => p.id === r.post_id); if (post) post.reply_count = Math.max(0, post.reply_count - 1); }
    if (table === "community_amens") for (const a of allowed) { const post = db.community_posts.find((p) => p.id === a.post_id); if (post) post.amen_count = Math.max(0, post.amen_count - 1); }
    return allowed;
  };
  const cascadeUser = (ids) => {
    const gone = new Set(ids);
    db.likes = db.likes.filter((l) => !gone.has(l.from_user) && !gone.has(l.to_user));
    db.skips = db.skips.filter((s) => !gone.has(s.from_user) && !gone.has(s.to_user));
    const deadMatches = db.matches.filter((m) => gone.has(m.user1) || gone.has(m.user2)).map((m) => m.id);
    db.matches = db.matches.filter((m) => !deadMatches.includes(m.id));
    db.messages = db.messages.filter((m) => !deadMatches.includes(m.match_id));
    db.date_invitations = db.date_invitations.filter((i) => !deadMatches.includes(i.match_id));
    db.date_feedback = db.date_feedback.filter((f) => !gone.has(f.from_user) && !gone.has(f.to_user));
    db.blocks = db.blocks.filter((b) => !gone.has(b.blocker) && !gone.has(b.blocked));
    for (const t of ["photo_verifications", "spark_reveals", "push_subscriptions", "photo_originals"]) db[t] = db[t].filter((r) => !gone.has(r.user_id));
    db.profiles = db.profiles.filter((p) => !gone.has(p.id));
  };

  // ── functions in the database ──
  const rpc = (fn, args) => {
    const u = state.cur?.id;
    if (!u) throw err(401, "42501", `permission denied for function ${fn}`);
    switch (fn) {
      case "create_match_if_mutual": {
        const other = args.p_other;
        const kind = args.p_kind || "date";
        if (!other || other === u || !["date", "friend"].includes(kind)) throw err(400, "P0001", "Not allowed");
        const a = db.likes.some((l) => l.from_user === u && l.to_user === other && (l.kind || "date") === kind);
        const b = db.likes.some((l) => l.from_user === other && l.to_user === u && (l.kind || "date") === kind);
        if (!a || !b) return null;
        const ex = db.matches.find((m) => (m.kind || "date") === kind && ((m.user1 === u && m.user2 === other) || (m.user1 === other && m.user2 === u)));
        if (ex) return ex.id;
        const m = { id: uuid(), user1: u, user2: other, kind, created_at: nowIso(), last_activity: nowIso(), nudge_at: null, deadline_paused: false, video_call_at: null };
        db.matches.push(m);
        return m.id;
      }
      case "usage_limits": {
        const lim = limitsFor(u);
        const likesUsed = db.likes.filter((l) => l.from_user === u && l.kind !== "friend" && !l.is_dove && ts(l.created_at) >= dayStart()).length;
        const dovesUsed = db.likes.filter((l) => l.from_user === u && l.kind !== "friend" && l.is_dove && ts(l.created_at) >= weekStart()).length;
        const wavesUsed = db.likes.filter((l) => l.from_user === u && l.kind === "friend" && ts(l.created_at) >= dayStart()).length;
        const mine = db.spark_reveals.filter((r) => r.user_id === u).sort((a, b) => ts(a.created_at) - ts(b.created_at));
        const beyond = mine.slice(10).filter((x) => ts(x.created_at) >= weekStart()).length;
        const revealsUsed = premium(u) ? 0 : mine.length < 10 ? mine.length : beyond;
        const revealsLimit = premium(u) ? 1e6 : mine.length < 10 ? 10 : lim.reveals;
        return { premium: premium(u), likesUsed, likesLimit: lim.likes, dovesUsed, dovesLimit: lim.doves, wavesUsed, wavesLimit: lim.waves, revealsUsed, revealsLimit, starterRevealsLeft: Math.max(0, 10 - mine.length), likesResetAt: new Date(dayStart() + 86400e3).toISOString(), dovesResetAt: new Date(weekStart() + 7 * 86400e3).toISOString() };
      }
      case "reliability_for": {
        const out = {};
        for (const f of db.date_feedback) if (args.p_ids.includes(f.to_user)) { const o = out[f.to_user] || (out[f.to_user] = { user_id: f.to_user, dates: 0, no_shows: 0 }); o.dates++; if (!f.showed_up) o.no_shows++; }
        return Object.values(out);
      }
      case "react_to_message": {
        const m = db.messages.find((x) => x.id === args.p_message_id && participant(x.match_id, u));
        if (!m) return null;
        const r = { ...(m.reactions || {}) };
        if (!args.p_emoji) delete r[u]; else r[u] = String(args.p_emoji).slice(0, 8);
        m.reactions = r;
        return r;
      }
      default: state.unsupported.push(`rpc ${fn}`); throw err(404, "PGRST202", `Could not find the function public.${fn} in the schema cache`);
    }
  };

  // ── the fetch stand-in ──
  const realFetch = window.fetch.bind(window);
  const handle = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.origin);
    const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined));
    const method = (init.method || "GET").toUpperCase();
    if (!/supabase\.co$/.test(url.hostname)) {
      if (/nominatim/.test(url.hostname)) return json(200, url.pathname.includes("reverse") ? { address: { city: "Testville" } } : []);
      return realFetch(input, init);
    }
    state.calls++;
    const path = url.pathname;
    const bodyText = init.body ? (typeof init.body === "string" ? init.body : null) : null;
    const body = bodyText ? JSON.parse(bodyText) : null;

    if (path.startsWith("/functions/v1/")) {
      const name = path.split("/")[3];
      if (name === "stripe-checkout") return json(200, premium(state.cur?.id) ? { status: "active", plan: "price_1UF5K3CBLGZ7l0PdrdfmSFjw", currentPeriodEnd: Math.floor(Date.now() / 1000) + 20 * 86400, startedAt: Math.floor(Date.now() / 1000) - 10 * 86400, cancelAtPeriodEnd: false } : { status: "none", plan: null });
      if (name === "send-push") { state.pushes.push(body); return json(200, { ok: true, sent: 1 }); }
      if (name === "delete-account") { const u = state.cur?.id; if (u) { state.deleted.push(u); cascadeUser([u]); state.cur = null; } return json(200, { ok: true }); }
      return json(200, { ok: true });
    }
    if (path.startsWith("/storage/v1/object/")) return json(200, { Key: path.replace("/storage/v1/object/", ""), Id: uuid() });
    if (path.startsWith("/auth/v1/")) return json(200, { user: state.cur });

    if (path.startsWith("/rest/v1/rpc/")) {
      try { const out = rpc(path.split("/")[4], body || {}); return json(200, out); }
      catch (e) { if (e instanceof Response) return e; throw e; }
    }
    if (path.startsWith("/rest/v1/")) {
      const table = path.split("/")[3];
      const params = url.searchParams;
      const wantsObject = (headers.get("accept") || "").includes("vnd.pgrst.object");
      const prefer = headers.get("prefer") || "";
      const represent = prefer.includes("return=representation");
      const respond = (rows, status = 200) => {
        if (wantsObject) {
          if (rows.length !== 1) return err(406, "PGRST116", "JSON object requested, multiple (or no) rows returned", `Results contain ${rows.length} rows, application/vnd.pgrst.object+json requires 1 row`);
          return json(status, rows[0]);
        }
        return json(status, rows);
      };
      try {
        if (!state.cur) return json(200, wantsObject ? null : []);
        if (table === "profiles_public" && method !== "GET") return err(401, "42501", "permission denied for view profiles_public");
        if (method === "GET") return respond(applyQuery(visibleRows(table), params));
        if (method === "POST") {
          const rows = Array.isArray(body) ? body : [body];
          const conflict = params.get("on_conflict");
          const out = rows.map((r) => (prefer.includes("resolution=merge-duplicates") ? upsertRow(table, r, conflict) : insertRow(table, r)));
          return represent ? respond(out, 201) : json(201);
        }
        if (method === "PATCH") {
          const rows = applyQuery(visibleRows(table), params).map((r) => db[table].find((x) => x.id === r.id) || r);
          const out = updateRows(table, rows, body || {});
          return represent ? respond(out) : json(204);
        }
        if (method === "DELETE") {
          const rows = applyQuery(visibleRows(table), params).map((r) => db[table].find((x) => x.id === r.id) || r);
          const out = deleteRows(table, rows);
          return represent ? respond(out) : json(204);
        }
      } catch (e) { if (e instanceof Response) return e; throw e; }
    }
    state.unsupported.push(`${method} ${path}`);
    return err(404, "PGRST000", `unsupported ${method} ${path}`);
  };

  const install = () => {
    window.fetch = handle;
    supabase.auth.getSession = async () => ({ data: { session: state.cur ? { user: state.cur, access_token: "sim" } : null }, error: null });
    supabase.auth.getUser = async () => ({ data: { user: state.cur }, error: null });
    supabase.auth.signOut = async () => { state.cur = null; return { error: null }; };
  };
  const setUser = (id) => { state.cur = id ? { id, email: profileOf(id)?.email || `${id}@sim.test`, phone: null } : null; };
  const seedProfile = (row) => { db.profiles.push({ doves: 3, is_active: true, is_standout: false, subscription_status: "none", paused: false, details: {}, verified_photos: {}, notification_prefs: {}, traits: [], who_are_you: [], looking_for: [], bio: "", intent: "date", created_at: nowIso(), last_active: nowIso(), ...row }); };

  return { db, state, install, setUser, seedProfile, now, setOffset: (ms) => { state.offset = ms; } };
}
