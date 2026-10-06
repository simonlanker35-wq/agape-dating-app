// Deletes the calling user's account completely: uploaded files, every row that belongs to them,
// an active Agape+ subscription in Stripe, the profile, and finally the login itself.
// Requires the user's own session (verify_jwt stays on).
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?target=deno";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");
    const uid = user.id;
    const done: string[] = [];

    // 1. Stripe: stop any subscription so nothing renews after the account is gone
    const { data: profile } = await admin.from("profiles").select("stripe_customer_id").eq("id", uid).maybeSingle();
    if (stripeKey && profile?.stripe_customer_id) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
        const subs = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: "all", limit: 20 });
        for (const s of subs.data) {
          if (["active", "trialing", "past_due", "unpaid"].includes(s.status)) await stripe.subscriptions.cancel(s.id);
        }
        done.push("stripe");
      } catch (err) {
        console.warn("Stripe cleanup failed:", (err as Error).message);
      }
    }

    // 2. Uploaded files
    try {
      const paths: string[] = [];
      for (const folder of ["chat", "voice", "verify", "prompt"]) {
        const { data: files } = await admin.storage.from("media").list(`${uid}/${folder}`, { limit: 1000 });
        for (const f of files || []) paths.push(`${uid}/${folder}/${f.name}`);
      }
      if (paths.length) await admin.storage.from("media").remove(paths);
      done.push(`files:${paths.length}`);
    } catch (err) {
      console.warn("Storage cleanup failed:", (err as Error).message);
    }

    // 3. Rows that belong to the user. Tables that may not exist yet are skipped.
    const tryDelete = async (label: string, fn: () => PromiseLike<{ error: { message: string } | null }>) => {
      try {
        const { error } = await fn();
        if (error && !/relation .* does not exist|schema cache/i.test(error.message)) console.warn(`${label}:`, error.message);
        else done.push(label);
      } catch (err) {
        console.warn(`${label}:`, (err as Error).message);
      }
    };
    await tryDelete("photo_verifications", () => admin.from("photo_verifications").delete().eq("user_id", uid));
    await tryDelete("photo_originals", () => admin.from("photo_originals").delete().eq("user_id", uid));
    await tryDelete("push_subscriptions", () => admin.from("push_subscriptions").delete().eq("user_id", uid));
    await tryDelete("date_feedback", () => admin.from("date_feedback").delete().or(`from_user.eq.${uid},to_user.eq.${uid}`));
    await tryDelete("blocks", () => admin.from("blocks").delete().or(`blocker.eq.${uid},blocked.eq.${uid}`));
    await tryDelete("messages", () => admin.from("messages").delete().eq("sender", uid));
    // Matches cascade to their messages and date plans
    await tryDelete("matches", () => admin.from("matches").delete().or(`user1.eq.${uid},user2.eq.${uid}`));
    await tryDelete("likes", () => admin.from("likes").delete().or(`from_user.eq.${uid},to_user.eq.${uid}`));
    await tryDelete("skips", () => admin.from("skips").delete().or(`from_user.eq.${uid},to_user.eq.${uid}`));
    // Reports about this user are kept for the team (reporter/reported become null through the foreign keys)
    await tryDelete("profile", () => admin.from("profiles").delete().eq("id", uid));

    // 4. The login itself
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) throw new Error(`Could not delete the login: ${delErr.message}`);
    done.push("auth");

    return json({ ok: true, done });
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
});
