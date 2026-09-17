import posthog from "posthog-js";

posthog.init("phc_xro6ot7Wxs8Nrd7t4gL6yQKWK8n6LA4i8w4Q883jvHh8", {
  api_host: "https://eu.i.posthog.com",
  autocapture: true,
  capture_pageview: true,
  capture_pageleave: true,
  persistence: "localStorage",
  disable_session_recording: false,
  session_recording: {
    maskAllInputs: false,
    maskInputFn: (text, element) => {
      if (element?.type === "password") return "•".repeat(text.length);
      return text;
    },
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
