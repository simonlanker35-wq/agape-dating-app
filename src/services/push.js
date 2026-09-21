import { savePushSubscription, deletePushSubscription } from "./api";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "BFu5T8VazpR1qoXJC9yT2hWXQ7-rWTzOZL5ntmEuWw3NbAdxM3ts0uuLEKBpLqqwEEGlcSRTPvk0g_Oz_CvqC7A";

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
}

// On iPhone, web push only works once the app is added to the Home Screen
export function needsHomeScreenInstall() {
  return isIOS() && !isStandalone();
}

export function getPermission() {
  return isPushSupported() ? Notification.permission : "unsupported";
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js");
}

export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  const reg = await getRegistration();
  return reg.pushManager.getSubscription();
}

export async function enablePush() {
  if (!isPushSupported()) throw new Error("Notifications aren't supported in this browser");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications were not allowed");
  const reg = await getRegistration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  }
  await savePushSubscription(sub.toJSON());
  try { localStorage.setItem("agape_push", "on"); } catch {}
  return sub;
}

export async function disablePush() {
  const sub = await getCurrentSubscription();
  if (sub) {
    await deletePushSubscription(sub.endpoint);
    await sub.unsubscribe();
  }
  try { localStorage.setItem("agape_push", "off"); } catch {}
}

// Re-save the subscription after login so the row always points at the current user
export async function syncPushSubscription() {
  try {
    if (getPermission() !== "granted") return;
    let off = false;
    try { off = localStorage.getItem("agape_push") === "off"; } catch {}
    if (off) return;
    const sub = await getCurrentSubscription();
    if (sub) await savePushSubscription(sub.toJSON());
  } catch {}
}

export async function isPushEnabled() {
  if (getPermission() !== "granted") return false;
  const sub = await getCurrentSubscription();
  return !!sub;
}
