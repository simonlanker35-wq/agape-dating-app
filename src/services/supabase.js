import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ksscosugtbdzgekrszck.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_Pc7SxQWxxEMLyD8DqbtdoQ_t47R8Ydu";

export const supabase = createClient(supabaseUrl, supabaseKey);
