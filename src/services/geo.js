// City name ⇄ coordinates through OpenStreetMap's Nominatim, used so a typed city gets real
// coordinates and the phone's GPS never stands in for a place the person chose.

const pickCity = (a) => a?.city || a?.town || a?.village || a?.municipality || a?.county || "";

export async function geocodeCity(name) {
  const q = String(name || "").trim();
  if (q.length < 2) return null;
  try {
    // limit=1 sometimes returns nothing for well-known cities, so a few results are fetched and the first
    // place-like one is used (the city picker does the same)
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5&accept-language=en`);
    const rows = await resp.json();
    const list = Array.isArray(rows) ? rows : [];
    const r = list.find((x) => x.class === "place" || x.class === "boundary") || list[0];
    if (!r) return null;
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, city: pickCity(r.address) || q };
  } catch (_) {
    return null;
  }
}

export async function reverseCity(lat, lng) {
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&accept-language=en`);
    const data = await resp.json();
    return pickCity(data.address);
  } catch (_) {
    return "";
  }
}
