import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "./admins";

/**
 * 관리자 전용 API 라우트의 첫 줄에서 호출한다.
 * 통과하면 null, 막아야 하면 응답을 돌려주므로 그대로 return 하면 된다.
 *
 * proxy에서 /admin/* 페이지를 막고 있지만, /api/admin/*은 별개 경로라 거기 규칙에
 * 안 걸린다. 게이트를 한 곳에만 두면 경로 규칙이 바뀔 때 조용히 뚫리므로,
 * 각 라우트가 스스로를 지키게 한다.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  }
  return null;
}
