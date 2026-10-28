// Password rules for new passwords (sign-up, set password, reset). Logging in still accepts
// older 6-character passwords, so existing accounts keep working.

export const PASSWORD_HINT = "At least 8 characters, with a letter and a number.";

// Returns what is wrong with a new password, or null when it is fine.
export function passwordProblem(pw) {
  const p = String(pw || "");
  if (p.length < 8) return "Use at least 8 characters.";
  if (p.length > 72) return "Use at most 72 characters.";
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return "Use at least one letter and one number.";
  return null;
}

// Checks the password against known data breaches (Have I Been Pwned, k-anonymity range API).
// Only the first 5 characters of the password's SHA-1 hash leave the device, never the password.
// Fails open: if the service is slow or unreachable, the password is allowed.
export async function isLeakedPassword(pw) {
  try {
    if (!globalThis.crypto?.subtle) return false;
    const bytes = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(String(pw || "")));
    const hash = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { "Add-Padding": "true" }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const text = await res.text();
    return text.split("\n").some((line) => {
      const [hashSuffix, count] = line.trim().split(":");
      return hashSuffix === suffix && Number(count) > 0;
    });
  } catch (_) {
    return false;
  }
}

export const LEAKED_MESSAGE = "This password has appeared in a data breach. Please choose a different one.";
