// One-off diagnostic: how big the rows the app downloads are, per table. Token-protected.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?target=deno";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const token = Deno.env.get("MIGRATE_TOKEN") || "";
const size = (v: unknown) => new TextEncoder().encode(JSON.stringify(v ?? null)).length;
Deno.serve(async (req) => {
  if (req.headers.get("x-migrate-token") !== token || !token) return new Response("Forbidden", { status: 403 });
  const out: Record<string, unknown> = {};
  const { data: profiles } = await admin.from("profiles").select("*");
  const ps = (profiles || []);
  out.profiles = { rows: ps.length, totalKB: Math.round(size(ps) / 1024), photosKB: Math.round(size(ps.map((p) => p.photos)) / 1024), promptsKB: Math.round(size(ps.map((p) => p.prompts)) / 1024), verifiedKB: Math.round(size(ps.map((p) => p.verified_photos)) / 1024), biggestRowKB: Math.round(Math.max(...ps.map((p) => size(p))) / 1024), inlinePhotosLeft: ps.filter((p) => (p.photos || []).some((u: string) => String(u).startsWith("data:"))).length };
  const { data: originals } = await admin.from("photo_originals").select("*");
  out.photo_originals = { rows: (originals || []).length, totalKB: Math.round(size(originals) / 1024) };
  const { data: msgs } = await admin.from("messages").select("*");
  out.messages = { rows: (msgs || []).length, totalKB: Math.round(size(msgs) / 1024) };
  const { data: likes } = await admin.from("likes").select("*");
  out.likes = { rows: (likes || []).length, totalKB: Math.round(size(likes) / 1024) };
  const { data: ver } = await admin.from("photo_verifications").select("*");
  out.photo_verifications = { rows: (ver || []).length, totalKB: Math.round(size(ver) / 1024) };
  const { data: files } = await admin.storage.from("media").list("", { limit: 1000 });
  out.media_folders = (files || []).length;
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
});
