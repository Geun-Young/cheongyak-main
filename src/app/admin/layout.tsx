import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Container } from "@/components/ui";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <div className="border-b border-line bg-ink text-white">
        <Container className="flex h-11 items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-4">
            <span className="font-bold">관리자 콘솔</span>
            <nav className="flex gap-3 text-white/80">
              <Link href="/admin/announcements" className="hover:text-white">공고 목록</Link>
              <Link href="/admin/announcements/new" className="hover:text-white">새 공고</Link>
            </nav>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-warn-soft">
            <ShieldAlert size={14} />
            인증 게이트 미연결. 연동 시 requireAdmin 뒤로 옮길 것
          </span>
        </Container>
      </div>
      {children}
    </>
  );
}
