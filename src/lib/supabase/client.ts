import { createBrowserClient } from "@supabase/ssr";

/**
 * 클라이언트 컴포넌트("use client")에서 쓰는 Supabase 클라이언트.
 * anon key만 사용한다 — RLS가 실제 접근 제어를 담당하므로 이 키가 노출돼도 안전하다.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
