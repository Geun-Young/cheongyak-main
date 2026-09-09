import { NextResponse } from "next/server";
import { getAnnouncementByIdForAdmin } from "@/lib/data/announcements";
import { requireAdmin } from "@/lib/data/require-admin";

/**
 * 관리자 편집 화면(admin/announcements/new?id=...)이 클라이언트에서 fetch로 불러오는 API.
 * service_role로 draft·closed도 조회한다.
 * 관리자만 호출할 수 있다(requireAdmin).
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/announcements/[id]">) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const announcement = await getAnnouncementByIdForAdmin(id);
  if (!announcement) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(announcement);
}
