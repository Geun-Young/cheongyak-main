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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 로그인이 필요한 경로를 여기서 막는다. 화면 안에서만 막으면 잠깐 내용이 보였다가
  // 사라지는 깜빡임이 생기고, 서버 컴포넌트가 이미 데이터를 읽은 뒤라 낭비도 된다.
  const { pathname } = request.nextUrl;
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const needsAuth =
    isAdminPath ||
    ["/me", "/onboarding", "/notifications"].some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (needsAuth && !user) {
    const loginUrl = new URL("/login", request.url);
    // 로그인 후 원래 가려던 곳으로 돌려보낸다.
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 관리자 화면은 로그인만으로는 부족하다. admins 테이블에 등록된 사람만 통과시킨다.
  // 이 조회는 /admin/* 요청에만 하므로 일반 페이지 성능에는 영향이 없다.
  if (isAdminPath && user) {
    const { isAdmin } = await import("@/lib/data/admins");
    if (!(await isAdmin(user.id))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}
