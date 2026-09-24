// Browser-side helpers for recording audio and preparing images. No network calls here.

export function isRecordingSupported() {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== "undefined";
}

// Safari records AAC in MP4, Chrome and Firefox record Opus in WebM. Pick what the browser can do.
export function pickRecorderMime() {
  const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  for (const c of candidates) {
    try { if (window.MediaRecorder?.isTypeSupported?.(c)) return c; } catch (_) {}
  }
  return "";
}

export function extForMime(mime) {
  if (!mime) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

export function formatDuration(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Read a File as a data URL
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Shrink an image file for chat: longest side 1280px, JPEG. Returns a Blob.
export function prepareChatImage(file, max = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * ratio);
      c.height = Math.round(img.naturalHeight * ratio);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not process image"))), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}

// Start recording from the microphone. Returns { stop(): Promise<{blob, mime, duration}>, cancel() }.
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = pickRecorderMime();
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks = [];
  const startedAt = Date.now();
  rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  rec.start(250);

  const stopTracks = () => stream.getTracks().forEach((t) => t.stop());

  return {
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          stopTracks();
          const type = rec.mimeType || mime || "audio/webm";
          resolve({ blob: new Blob(chunks, { type }), mime: type, duration: (Date.now() - startedAt) / 1000 });
        };
        rec.state !== "inactive" ? rec.stop() : rec.onstop();
      }),
    cancel: () => {
      try { if (rec.state !== "inactive") rec.stop(); } catch (_) {}
      stopTracks();
    },
  };
}
