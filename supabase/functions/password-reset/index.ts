// Password reset by email.
//
// Why this exists instead of calling Supabase's reset directly from the app:
//  - People who signed up with their phone number only have their email on their profile, not on
//    their login, so Supabase finds no account for it. This function attaches the email first.
//  - It can send the email through Resend with our own design. Without a RESEND_API_KEY secret
//    it falls back to Supabase's own mailer (which needs custom SMTP to reach real users).
//
// It always answers the same way for known and unknown addresses, so it cannot be used to find
// out who has an account.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?target=deno";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendKey = Deno.env.get("RESEND_API_KEY") || "";
const fromAddress = Deno.env.get("RESET_FROM") || "Agape <noreply@agapeapp.net>";

// Where the link in the email may send people back to
const ALLOWED_ORIGINS = [
  "https://agapeapp.net",
  "https://www.agapeapp.net",
  "https://agape-dating-app-frontend.onrender.com",
  "http://localhost:5173",
];
const DEFAULT_ORIGIN = "https://agape-dating-app-frontend.onrender.com";
const THROTTLE_MS = 60_000; // one email per account per minute

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function emailHtml(name: string, link: string) {
  const hello = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#F4F2EE;font-family:Arial,Helvetica,sans-serif;color:#1A1612;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2EE;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#FFFFFF;border-radius:20px;padding:32px 28px;">
        <tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#B8912A;padding-bottom:20px;">agape</td></tr>
        <tr><td style="font-size:20px;font-weight:bold;padding-bottom:12px;">Reset your password</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;color:#5F5A53;padding-bottom:24px;">
          ${hello}<br><br>
          Someone asked to reset the password of your Agape account. Tap the button to choose a new one.
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <a href="${link}" style="display:inline-block;background:#111111;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 28px;border-radius:14px;">Choose a new password</a>
        </td></tr>
        <tr><td style="font-size:13px;line-height:1.6;color:#8C857C;">
          The link works once and expires after one hour. Open it on the phone or computer where you use Agape.<br><br>
          If this was not you, you can ignore this email. Your password stays the same.
        </td></tr>
      </table>
      <p style="font-size:12px;color:#8C857C;margin:16px 0 0;">Agape &middot; faith + love</p>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
      return json({ error: "Please enter a valid email address." }, 400);
    }
    const origin = ALLOWED_ORIGINS.includes(String(body.redirectTo || "")) ? String(body.redirectTo) : DEFAULT_ORIGIN;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // 1. Find the account. The profile is the reliable place: it carries the email for phone sign-ups too.
    let userId: string | null = null;
    let name = "";
    const { data: rows } = await admin.from("profiles").select("id, name, email").ilike("email", escapeLike(email)).limit(5);
    const profile = (rows || []).find((r) => String(r.email || "").trim().toLowerCase() === email);
    if (profile) {
      userId = profile.id;
      name = profile.name || "";
    }

    // 2. Throttle, and make sure the login itself knows this email
    let appMeta: Record<string, unknown> = {};
    if (userId) {
      const { data: got } = await admin.auth.admin.getUserById(userId);
      const user = got?.user;
      if (user) {
        appMeta = (user.app_metadata as Record<string, unknown>) || {};
        const last = Number(appMeta.reset_requested_at || 0);
        if (last && Date.now() - last < THROTTLE_MS) return json({ ok: true }); // just sent one

        if ((user.email || "").toLowerCase() !== email) {
          // Phone (or other) sign-up: attach the profile's email to the login so a reset can reach it.
          // If another login already owns this address this fails, and the reset goes to that login.
          const { error: attachErr } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
          if (attachErr) console.warn("Could not attach email to login:", attachErr.message);
        }
      }
    }

    // 3. Send
    if (resendKey) {
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: origin } });
      if (linkErr || !link?.properties?.action_link) {
        // No login with this email: answer exactly as if it had worked
        return json({ ok: true });
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAddress,
          to: [email],
          subject: "Reset your Agape password",
          html: emailHtml(name, link.properties.action_link),
          text: `Reset your Agape password\n\nOpen this link to choose a new password (valid for one hour):\n${link.properties.action_link}\n\nIf this was not you, ignore this email.`,
        }),
      });
      if (!res.ok) {
        console.error("Resend failed:", res.status, (await res.text()).slice(0, 300));
        return json({ error: "We could not send the email right now. Please try again in a few minutes." }, 502);
      }
    } else {
      // Supabase's own mailer. Unknown addresses and its rate limit both come back without detail on purpose.
      const { error: mailErr } = await admin.auth.resetPasswordForEmail(email, { redirectTo: origin });
      if (mailErr) {
        console.warn("Supabase mailer:", mailErr.message);
        if (/rate limit|security purposes/i.test(mailErr.message)) {
          return json({ error: "Too many reset emails were requested. Please wait a few minutes and try again." }, 429);
        }
      }
    }

    if (userId) {
      await admin.auth.admin.updateUserById(userId, { app_metadata: { ...appMeta, reset_requested_at: Date.now() } });
    }
    return json({ ok: true });
  } catch (err) {
    console.error("password-reset failed:", (err as Error).message);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
