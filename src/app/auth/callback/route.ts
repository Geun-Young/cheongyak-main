import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // 원래 가려던 곳이 있으면 그리로.
  if (next) return NextResponse.redirect(`${origin}${next}`);

  // 처음 온 사람(프로필 없음)은 정보 입력부터, 이미 입력한 사람은 대시보드로.
  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("onboarding_done")
    .eq("user_id", data.user.id)
    .maybeSingle();

  const destination = profileRow?.onboarding_done ? "/dashboard" : "/onboarding";
  return NextResponse.redirect(`${origin}${destination}`);
}
