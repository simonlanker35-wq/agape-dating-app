import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, name, stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (req.method === "GET") {
      const url = new URL(req.url);
      if (url.searchParams.get("action") === "status") {
        if (!profile?.stripe_customer_id) {
          return new Response(JSON.stringify({ status: "none", plan: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const subscriptions = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: "active",
          limit: 1,
        });

        const sub = subscriptions.data[0];
        if (sub) {
          await supabase
            .from("profiles")
            .update({ subscription_status: "active", subscription_id: sub.id })
            .eq("id", user.id);
        }
        return new Response(
          JSON.stringify({
            status: sub ? "active" : "none",
            plan: sub ? sub.items.data[0]?.price?.id : null,
            currentPeriodEnd: sub ? sub.current_period_end : null,
            cancelAtPeriodEnd: sub ? sub.cancel_at_period_end : false,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { priceId } = await req.json();
    if (!priceId) throw new Error("Missing priceId");

    let customerId = profile?.stripe_customer_id;

    const origin = req.headers.get("origin") || "https://agape-dating-app-frontend.onrender.com";

    const sessionData: Record<string, unknown> = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}?subscription=success`,
      cancel_url: `${origin}?subscription=cancelled`,
      metadata: { supabase_user_id: user.id },
    };

    // Create the customer before checkout so the status lookup works even if the webhook never arrives
    if (!customerId) {
      const email = user.email || (profile?.email?.includes("@") ? profile.email : null);
      const customer = await stripe.customers.create({
        ...(email ? { email } : {}),
        ...(profile?.name ? { name: profile.name } : {}),
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }
    sessionData.customer = customerId;

    const session = await stripe.checkout.sessions.create(sessionData);

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
