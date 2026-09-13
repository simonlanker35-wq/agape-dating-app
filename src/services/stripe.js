import { supabase } from "./supabase";

export async function redirectToCheckout(priceId) {
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

  const { url } = await resp.json();
  window.location.href = url;
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
