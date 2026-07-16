import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error('.env.local에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 설정해 주세요')
}

export const supabase = createClient(url, anonKey)
