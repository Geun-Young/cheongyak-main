import { NextResponse } from "next/server";
import { markAnnouncementReady } from "@/lib/data/ai-drafts";

/**
 * 관리자가 검수 화면에서 "판정 가능으로 전환" 버튼을 누르면 호출된다.
 * 유닛에 조건을 반영하는 것과 별개 스위치다 — 여러 유닛을 다 확인한 뒤 마지막에 누른다.
 * TODO(인증): /admin/* 전체와 마찬가지로 아직 로그인 게이트가 없다.
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/admin/announcements/[id]/mark-ready">) {
  const { id } = await ctx.params;
  await markAnnouncementReady(id);
  return NextResponse.json({ ok: true });
}
