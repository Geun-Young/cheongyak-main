import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 로그인 직후 갈 곳. 원래 가려던 곳(next, 같은 사이트 경로만)이 있으면 그리로,
 * 처음 온 사람(프로필 없음)은 정보 입력부터, 이미 입력한 사람은 대시보드로.
 */
export async function afterLoginPath(supabase: SupabaseClient, userId: string, next: string | null): Promise<string> {
  // "//evil.com" 같은 다른 사이트 주소로 보내지 않는다
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  const { data } = await supabase.from("user_profiles").select("onboarding_done").eq("user_id", userId).maybeSingle();
  return data?.onboarding_done ? "/dashboard" : "/onboarding";
}
