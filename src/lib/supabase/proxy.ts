import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * proxy.ts에서 호출하는 세션 갱신 로직.
 * (Next.js 16부터 middleware.ts가 proxy.ts로 이름이 바뀌었다 — 동작은 동일)
 *
 * Supabase 세션은 만료되기 전에 매 요청마다 토큰을 갱신해야 하는데,
 * 서버 컴포넌트는 쿠키를 쓸 수 없어 이 작업을 proxy에서 대신 처리한다.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // 토큰이 만료됐으면 갱신한다. getUser()가 매번 Supabase Auth 서버로 검증 요청을 보내
  // 로컬 세션 위조를 막아준다 — getSession()만 쓰면 위조 가능하므로 반드시 이걸 호출한다.
  await supabase.auth.getUser();

  return response;
}
