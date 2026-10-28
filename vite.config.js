import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Content Security Policy for the production build only. It limits where scripts may load from,
// so an injected <script> or a script from a foreign host is refused by the browser. This is the
// main defence for the login session, which Supabase keeps in localStorage. The dev server is left
// alone because Vite's hot reload uses inline scripts.
function contentSecurityPolicy(supabaseUrl) {
  const supabase = new URL(supabaseUrl).host
  const policy = [
    "default-src 'self'",
    "script-src 'self' https://eu-assets.i.posthog.com https://eu.i.posthog.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `media-src 'self' data: blob: https://${supabase}`,
    `connect-src 'self' https://${supabase} wss://${supabase} https://nominatim.openstreetmap.org https://eu.i.posthog.com https://eu-assets.i.posthog.com https://api.pwnedpasswords.com`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'agape-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head-prepend' },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseUrl = env.VITE_SUPABASE_URL || 'https://ksscosugtbdzgekrszck.supabase.co'
  return {
    plugins: [react(), contentSecurityPolicy(supabaseUrl)],
    server: {
      host: true,
    },
  }
})
