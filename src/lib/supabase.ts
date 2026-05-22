import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  const msg = `Supabase env vars zijn niet gezet. Voeg VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY toe in Vercel → Settings → Environment Variables en redeploy.`
  console.error(msg, { supabaseUrl, hasAnonKey: !!supabaseAnonKey })
  throw new Error(msg)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
