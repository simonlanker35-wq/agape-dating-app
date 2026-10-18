// One-off: moves profile photos that are still stored as data URLs inside profiles.photos into the
// public "media" bucket and rewrites the rows with links. Protected by MIGRATE_TOKEN; runs in batches.
// POST with header "x-migrate-token: <token>"; JSON body { batch: 5, after: "<last id>" }.
// Walks the profiles in id order and returns `nextAfter` to continue, or `finished: true`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?target=deno";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const token = Deno.env.get("MIGRATE_TOKEN") || "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function decodeDataUrl(u: string): { bytes: Uint8Array; type: string; ext: string } | null {
  const m = /^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/i.exec(u);
  if (!m) return null;
  const type = m[1].toLowerCase() === "image/jpg" ? "image/jpeg" : m[1].toLowerCase();
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const bin = atob(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type, ext };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!token || req.headers.get("x-migrate-token") !== token) return json({ error: "Forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const batch = Math.min(20, Math.max(1, Number(body.batch) || 5));
  const after = typeof body.after === "string" && body.after ? body.after : "00000000-0000-0000-0000-000000000000";
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // ids only (cheap); the photo column is read one profile at a time
  const { data: ids, error } = await admin.from("profiles").select("id").gt("id", after).order("id").limit(300);
  if (error) return json({ error: error.message }, 500);

  const done: { id: string; uploaded: number; kept: number }[] = [];
  const failed: { id: string; error: string }[] = [];
  let scanned = 0;
  let nextAfter = after;
  for (const { id } of ids || []) {
    scanned++;
    nextAfter = id;
    const { data: row, error: rErr } = await admin.from("profiles").select("id, photos").eq("id", id).single();
    if (rErr || !row) { failed.push({ id, error: rErr?.message || "not found" }); continue; }
    const photos: string[] = Array.isArray(row.photos) ? row.photos : [];
    if (!photos.some((u) => typeof u === "string" && u.startsWith("data:image/"))) continue;
    try {
      const out: string[] = [];
      let uploaded = 0, kept = 0;
      for (let i = 0; i < photos.length; i++) {
        const u = photos[i];
        const dec = typeof u === "string" ? decodeDataUrl(u) : null;
        if (!dec) { out.push(u); kept++; continue; }
        const name = `${id}/profile/${Date.now()}-${i}-${crypto.randomUUID().slice(0, 8)}.${dec.ext}`;
        const { error: upErr } = await admin.storage.from("media").upload(name, dec.bytes, { contentType: dec.type, cacheControl: "31536000", upsert: false });
        if (upErr) throw new Error(upErr.message);
        out.push(admin.storage.from("media").getPublicUrl(name).data.publicUrl);
        uploaded++;
      }
      const { error: updErr } = await admin.from("profiles").update({ photos: out }).eq("id", id);
      if (updErr) throw new Error(updErr.message);
      done.push({ id, uploaded, kept });
    } catch (e) {
      failed.push({ id, error: (e as Error).message });
    }
    if (done.length + failed.length >= batch) break;
  }

  const finished = scanned === (ids || []).length && (ids || []).length < 300;
  return json({ processed: done.length, uploaded: done.reduce((n, d) => n + d.uploaded, 0), failed, scanned, nextAfter, finished });
});
