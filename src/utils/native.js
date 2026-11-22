// Everything that differs when Agape runs inside the iOS / Android app (Capacitor) instead of the browser.
import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();
export const nativePlatform = Capacitor.getPlatform(); // "ios" | "android" | "web"

// Links that leave the app (email confirmation, password reset) must point at the website:
// inside the app the page's own origin is capacitor://localhost or https://localhost.
const WEB_ORIGIN = "https://agape-dating-app-frontend.onrender.com";
export const publicOrigin = () => (isNative ? WEB_ORIGIN : window.location.origin);

// Google refuses to sign in inside an embedded web view, so the app opens the system browser
// and Supabase sends the person back through this link. It must be listed in
// Supabase → Authentication → URL Configuration → Redirect URLs.
export const NATIVE_AUTH_REDIRECT = "net.agapeapp.app://auth";

export async function openInSystemBrowser(url) {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, presentationStyle: "popover" });
}

// Called once at start-up in the app. Finishes a Google sign-in when the browser hands back,
// and makes the Android back button close the open sheet instead of quitting the app.
export async function initNative({ onAuthUrl, onBack }) {
  if (!isNative) return;
  const { App } = await import("@capacitor/app");
  App.addListener("appUrlOpen", async ({ url }) => {
    if (!url || !url.startsWith(NATIVE_AUTH_REDIRECT)) return;
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.close();
    } catch { /* already closed (Android) */ }
    await onAuthUrl(url);
  });
  App.addListener("backButton", () => {
    if (!onBack()) App.minimizeApp();
  });
}
