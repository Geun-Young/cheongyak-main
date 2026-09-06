import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * service_role 키로 RLS를 우회하는 관리자 전용 클라이언트.
 * 절대 클라이언트 컴포넌트에서 import하지 않는다 — "server-only"가 실수로 그런 import를
 * 빌드 타임 에러로 막아준다.
 *
 * TODO(인증): 지금은 /admin/*에 로그인 게이트가 없어 임시로 이 클라이언트를 쓴다.
 * 관리자 인증이 붙으면 이 파일 대신 일반 서버 클라이언트(server.ts) + "role = admin"
 * RLS 정책으로 교체한다.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
