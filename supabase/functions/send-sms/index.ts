import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?target=deno";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_VERIFY_SID = Deno.env.get("TWILIO_VERIFY_SID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, action, code } = await req.json();

    if (!phone) {
      return new Response(JSON.stringify({ error: "Phone number required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SEND OTP ──
    if (action !== "verify") {
      const res = await fetch(
        `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SID}/Verifications`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${twilioAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: phone, Channel: "sms" }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        console.error("Twilio send error:", data);
        return new Response(JSON.stringify({ error: data.message || "Failed to send code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── VERIFY OTP ──
    if (!code) {
      return new Response(JSON.stringify({ error: "Code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checkRes = await fetch(
      `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SID}/VerificationChecks`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${twilioAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, Code: code }),
      }
    );
    const checkData = await checkRes.json();

    if (checkData.status !== "approved") {
      return new Response(JSON.stringify({ error: "Invalid code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Code verified — sign user into Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find existing user by phone
    const { data: { users } } = await supabase.auth.admin.listUsers();
    let user = users.find((u: any) => u.phone === phone);

    const tempPassword = crypto.randomUUID();

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        phone,
        phone_confirm: true,
        password: tempPassword,
      });
      if (error) throw error;
      user = data.user;
    } else {
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        password: tempPassword,
      });
      if (error) throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      verified: true,
      userId: user.id,
      phone,
      token: tempPassword,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
