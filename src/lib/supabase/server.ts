import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버 컴포넌트 / 서버 액션 / 라우트 핸들러에서 쓰는 Supabase 클라이언트.
 * Next.js 16 기준 cookies()는 async이므로 이 함수도 async로 감싼다.
 *
 * 서버 컴포넌트 렌더링 중에는 쿠키를 쓸 수 없어(Next.js 제약) set이 실패할 수 있는데,
 * 미들웨어가 세션 갱신을 대신 처리하는 한 무시해도 되는 에러다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component에서 호출된 경우 — 미들웨어가 세션 갱신을 대신 처리한다.
          }
        },
      },
    },
  );
}
