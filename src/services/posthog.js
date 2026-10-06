import posthog from "posthog-js";

posthog.init("phc_xro6ot7Wxs8Nrd7t4gL6yQKWK8n6LA4i8w4Q883jvHh8", {
  api_host: "https://eu.i.posthog.com",
  autocapture: true,
  capture_pageview: true,
  capture_pageleave: true,
  persistence: "localStorage",
  disable_session_recording: false,
  // Recordings never contain what people type or write to each other
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: ".thread-panel, [data-private], textarea",
  },
});

export default posthog;

export function identify(userId, properties = {}) {
  posthog.identify(userId, properties);
}

export function track(event, properties = {}) {
  posthog.capture(event, properties);
}

export function reset() {
  posthog.reset();
}
