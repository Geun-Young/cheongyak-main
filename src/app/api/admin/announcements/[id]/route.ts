import { NextResponse } from "next/server";
import { getAnnouncementByIdForAdmin } from "@/lib/data/announcements";

/**
 * 관리자 편집 화면(admin/announcements/new?id=...)이 클라이언트에서 fetch로 불러오는 API.
 * service_role로 draft·closed도 조회한다.
 * TODO(인증): /admin/* 로그인 게이트가 붙기 전까지는 이 라우트도 관리자만 호출한다는 전제.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/announcements/[id]">) {
  const { id } = await ctx.params;
  const announcement = await getAnnouncementByIdForAdmin(id);
  if (!announcement) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(announcement);
}
