import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * "조건 정리되면 알려주세요" 버튼(설계서 3장). request_count를 1 늘려
 * 관리자 큐 정렬(요청 많은 공고부터)의 신호로 쓴다.
 *
 * TODO(인증): 지금은 로그인 여부와 무관하게 누구나 호출할 수 있고, 중복 클릭 방지도 없다.
 * 회원 인증이 붙으면 (1) 로그인한 사용자만 (2) 사용자당 공고당 1회만 카운트되도록
 * user_id 기반 유니크 제약을 추가한다. 지금은 관리자 큐 우선순위를 위한 대략적인 신호로만 쓴다.
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/announcements/[id]/request-review">) {
  const { id } = await ctx.params;
  const supabase = createAdminClient();

  const { data: current, error: readErr } = await supabase
    .from("announcements")
    .select("request_count")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { error: updateErr } = await supabase
    .from("announcements")
    .update({ request_count: current.request_count + 1 })
    .eq("id", id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
