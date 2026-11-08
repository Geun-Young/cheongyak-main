import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { afterLoginPath } from "@/lib/auth-redirect";

/**
 * OAuth(카카오)·이메일 인증 링크에서 돌아오는 지점.
 * Supabase가 붙여주는 ?code=... 를 세션 쿠키로 교환한다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("로그인을 마치지 못했어요. 다시 시도해 주세요.")}`,
    );
  }

  return NextResponse.redirect(`${origin}${await afterLoginPath(supabase, data.user.id, next)}`);
}
