import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 관리자 여부 확인. admins 테이블은 일반 사용자에게 권한을 주지 않아서(RLS 정책 자체가
 * 없음) service_role로만 읽을 수 있다 — 사용자가 스스로 관리자가 되는 경로를 구조적으로
 * 막기 위함이다(마이그레이션 0006 참고).
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}
