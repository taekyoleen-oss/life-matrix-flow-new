import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] URL 또는 Anon Key가 없습니다. Supabase 기능이 비활성화됩니다."
  );
}

// 환경변수가 없을 때 createClient가 예외를 던지지 않도록 placeholder 사용
// 실제 Supabase 호출 전 isSupabaseConfigured()로 체크
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);

export function isSupabaseConfigured(): boolean {
  return Boolean(
    (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)
  );
}
