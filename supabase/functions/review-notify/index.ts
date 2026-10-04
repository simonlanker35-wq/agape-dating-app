// Sends the "your photo has been reviewed" push notification.
// Called by a database trigger when the team sets a verification selfie to approved or rejected.
// It needs no secret: it only ever sends a notification that is genuinely due, which it checks
// against the database itself, and it sends each one once.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?target=deno";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:agape_dating@outlook.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  try {
    const { user_id, kind } = await req.json();
    if (!user_id || !["church", "bible"].includes(kind)) throw new Error("Missing user_id or kind");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: row } = await supabase
      .from("photo_verifications")
      .select("status, note, notified_at")
      .eq("user_id", user_id)
      .eq("kind", kind)
      .maybeSingle();

    if (!row || (row.status !== "approved" && row.status !== "rejected")) return json({ sent: 0, reason: "nothing to announce" });
    if (row.notified_at) return json({ sent: 0, reason: "already notified" });

    // Claim it first so two calls cannot both send
    const { data: claimed } = await supabase
      .from("photo_verifications")
      .update({ notified_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .eq("kind", kind)
      .is("notified_at", null)
      .select("user_id");
    if (!claimed || claimed.length === 0) return json({ sent: 0, reason: "already notified" });

    const what = kind === "church" ? "selfie with a church" : "selfie with a Bible";
    const payload = JSON.stringify({
      title: "Your photo has been reviewed",
      body: row.status === "approved"
        ? `Your ${what} is verified and now shows on your profile.`
        : `Your ${what} was not approved. Open Agape to see why and upload a new one.`,
      url: "/?tab=profile",
      tag: `review-${kind}`,
    });

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user_id);

    let sent = 0;
    const stale: string[] = [];
    for (const s of subs || []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 * 3 });
        sent++;
      } catch (err) {
        const e = err as { statusCode?: number };
        if (e.statusCode === 404 || e.statusCode === 410) stale.push(s.id);
      }
    }
    if (stale.length) await supabase.from("push_subscriptions").delete().in("id", stale);

    return json({ sent, devices: (subs || []).length });
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
});
