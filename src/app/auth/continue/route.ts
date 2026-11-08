import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { afterLoginPath } from "@/lib/auth-redirect";

/**
 * 브라우저에서 바로 로그인한 뒤(구글 버튼 → signInWithIdToken) 갈 곳을 정한다.
 * /auth/callback과 같은 규칙: next가 있으면 그리로, 처음 온 사람은 정보 입력, 아니면 대시보드.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(`${origin}/login`);
  return NextResponse.redirect(`${origin}${await afterLoginPath(supabase, data.user.id, searchParams.get("next"))}`);
}
