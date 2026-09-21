import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?target=deno";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:agape_dating@outlook.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { userId, title, body, url, tag } = await req.json();
    if (!userId || !title) throw new Error("Missing userId or title");

    // Only allow pushing to someone you're connected with: a shared match, or a like from you to them
    if (userId !== user.id) {
      const { data: match } = await supabase
        .from("matches")
        .select("id")
        .or(`and(user1.eq.${user.id},user2.eq.${userId}),and(user1.eq.${userId},user2.eq.${user.id})`)
        .limit(1)
        .maybeSingle();
      if (!match) {
        const { data: like } = await supabase
          .from("likes")
          .select("id")
          .eq("from_user", user.id)
          .eq("to_user", userId)
          .limit(1)
          .maybeSingle();
        if (!like) throw new Error("Not allowed");
      }
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    const payload = JSON.stringify({ title, body: body || "", url: url || "/", tag: tag || "agape" });
    let sent = 0;
    const stale: string[] = [];

    for (const s of subs || []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(s.id);
      }
    }

    if (stale.length) await supabase.from("push_subscriptions").delete().in("id", stale);

    return json({ sent, removed: stale.length });
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
});
