import { NextResponse } from "next/server";
import { approveDraftToUnit, getAiDraftDetail } from "@/lib/data/ai-drafts";

/**
 * 관리자가 초안 검수 화면에서 "이 조건을 이 유닛에 반영" 버튼을 누르면 호출된다.
 * body: { supplyUnitId: string, draftUnitIndex: number }
 * TODO(인증): /admin/* 전체와 마찬가지로 아직 로그인 게이트가 없다.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/ai-drafts/[id]/approve-unit">) {
  const { id } = await ctx.params;
  const { supplyUnitId, draftUnitIndex } = await req.json();

  if (typeof supplyUnitId !== "string" || typeof draftUnitIndex !== "number") {
    return NextResponse.json({ error: "supplyUnitId, draftUnitIndex가 필요해요." }, { status: 400 });
  }

  const detail = await getAiDraftDetail(id);
  if (!detail || !detail.aiDraft) {
    return NextResponse.json({ error: "초안을 찾을 수 없어요." }, { status: 404 });
  }
  const draftUnit = detail.aiDraft.unitsFound[draftUnitIndex];
  if (!draftUnit) {
    return NextResponse.json({ error: "해당 초안 유닛이 없어요." }, { status: 404 });
  }

  await approveDraftToUnit(id, supplyUnitId, draftUnit);
  return NextResponse.json({ ok: true });
}
