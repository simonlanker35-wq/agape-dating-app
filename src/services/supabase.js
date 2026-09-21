import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ksscosugtbdzgekrszck.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_Pc7SxQWxxEMLyD8DqbtdoQ_t47R8Ydu";

// The default navigator.locks-based auth lock can stall every request indefinitely on mobile
// after the app returns from the background, so run auth operations without it.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { lock: (_name, _acquireTimeout, fn) => fn() },
});
