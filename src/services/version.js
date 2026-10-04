// Notices when a newer build has been deployed while this tab stayed open.
// Every build has a uniquely named main script, so comparing that name is enough.

const BUNDLE = /assets\/index-[\w-]+\.js/;

// Name of the main script this tab is running, or null in development
export function currentBundle(doc = document) {
  for (const s of doc.scripts) {
    const m = (s.src || "").match(BUNDLE);
    if (m) return m[0];
  }
  return null;
}

// Pure comparison, kept separate so it can be tested: the script named in a freshly fetched
// index.html versus the one that is running. Returns the new name, or null if nothing changed.
export function newerBundle(html, running) {
  if (!running) return null;
  const m = (html || "").match(BUNDLE);
  return m && m[0] !== running ? m[0] : null;
}

// Fetches the current index.html (bypassing caches) and reports a newer build's script name, if any
export async function checkForUpdate() {
  const running = currentBundle();
  if (!running) return null;
  try {
    const res = await fetch(`/?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return newerBundle(await res.text(), running);
  } catch (_) {
    return null;
  }
}
