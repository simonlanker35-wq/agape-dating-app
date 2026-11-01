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

// action: "cancel" stops the renewal (Agape+ stays active until the paid period ends), "resume" undoes that.
async function changeRenewal(action) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const resp = await fetch(
    `https://ksscosugtbdzgekrszck.supabase.co/functions/v1/stripe-checkout`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action }),
    }
  );
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    // An older version of the server function answers a cancel request with "Missing priceId"
    throw new Error(body.error === "Missing priceId" ? "Cancelling isn't available yet. Please try again later." : body.error || "Could not update your subscription");
  }
  return body;
}

export const cancelSubscription = () => changeRenewal("cancel");
export const resumeSubscription = () => changeRenewal("resume");

// Looks up a paid Agape+ subscription in Stripe and links it to this account again.
// Resolves to the subscription status, with restored: false when nothing was found.
export async function restorePurchases() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const resp = await fetch(
    `https://ksscosugtbdzgekrszck.supabase.co/functions/v1/stripe-checkout`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "restore" }),
    }
  );
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    // The server function hasn't been updated yet and treats this as a checkout without a plan
    throw new Error(body.error === "Missing priceId" ? "Restoring isn't available yet. Please try again later." : body.error || "Could not restore your purchase");
  }
  return body;
}
