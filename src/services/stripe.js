import { loadStripe } from "@stripe/stripe-js";
import { supabase } from "./supabase";

const STRIPE_PK = "pk_test_51UF5DaCBLGZ7l0PdJpFyTngxBYMtGiENBeS1nlqsF249qVaftWNBz4XT39F6BR1OnGVuUHlRMprB66XJWIxH7qpi00Pu2cYulH";

let stripePromise;
export function getStripe() {
  if (!stripePromise) stripePromise = loadStripe(STRIPE_PK);
  return stripePromise;
}

export async function createCheckoutSession(priceId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const resp = await fetch(
    `https://ksscosugtbdzgekrszck.supabase.co/functions/v1/stripe-checkout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ priceId }),
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create checkout session");
  }

  return resp.json();
}

export async function redirectToCheckout(priceId) {
  const { sessionId } = await createCheckoutSession(priceId);
  const stripe = await getStripe();
  const { error } = await stripe.redirectToCheckout({ sessionId });
  if (error) throw new Error(error.message);
}

export async function getSubscriptionStatus() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const resp = await fetch(
    `https://ksscosugtbdzgekrszck.supabase.co/functions/v1/stripe-checkout?action=status`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }
  );

  if (!resp.ok) return null;
  return resp.json();
}
