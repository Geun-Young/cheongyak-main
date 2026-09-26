import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/data/require-admin";
import { getUpdateStatus, triggerUpdate } from "@/lib/data/update-runner";

/**
 * 공고 갱신 상태(GET)와 수동 실행(POST). 관리자 화면의 "지금 업데이트" 버튼이 부른다.
 * 실행 위치(GitHub Actions / 이 PC)는 update-runner.ts가 환경변수로 정한다.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json(await getUpdateStatus());
}

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const result = await triggerUpdate();
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
