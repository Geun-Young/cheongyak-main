import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ANNOUNCEMENTS } from "@/lib/mock/announcements";
import { formatDate } from "@/lib/format";
import { AgencyMark } from "@/components/AgencyMark";
import { ButtonLink, Card, Chip, Container, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "공고 관리" };

const STATUS: Record<string, { label: string; tone: "ok" | "muted" | "warn" }> = {
  published: { label: "게시 중", tone: "ok" },
  closed: { label: "마감", tone: "muted" },
  draft: { label: "임시저장", tone: "warn" },
};

export default function AdminAnnouncementsPage() {
  const pending = ANNOUNCEMENTS.filter((a) => a.reviewStatus === "pending").length;

  return (
    <Container className="py-6 md:py-10">
      <PageTitle
        title="공고 관리"
        lead={`총 ${ANNOUNCEMENTS.length}건. 조건 정리가 남은 공고 ${pending}건은 사용자에게 「확인 필요」로 보여요.`}
        action={
          <ButtonLink href="/admin/announcements/new">
            <Plus size={18} strokeWidth={2.6} /> 새 공고 등록
          </ButtonLink>
        }
      />

      <Card padded={false} className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[820px] text-[14px]">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-[12px] font-semibold text-ink-3">
              <th className="px-4 py-2.5">공고</th>
              <th className="px-3 py-2.5">유형</th>
              <th className="px-3 py-2.5">지역</th>
              <th className="px-3 py-2.5">접수 기간</th>
              <th className="px-3 py-2.5">상태</th>
              <th className="px-3 py-2.5">조건</th>
              <th className="px-3 py-2.5 text-right">규칙 수</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ANNOUNCEMENTS.map((a) => {
              const s = STATUS[a.status];
              return (
                <tr key={a.id} className="hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <AgencyMark code={a.agency.code} size="sm" />
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{a.title}</p>
                        <p className="text-[12px] text-ink-3">{a.agency.name} · {a.units.toLocaleString("ko-KR")}세대</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-ink-2">{a.housingType}</td>
                  <td className="px-3 py-3 text-ink-2">{a.region}</td>
                  <td className="px-3 py-3 text-ink-2 tnum whitespace-nowrap">{formatDate(a.applyStart)} ~ {formatDate(a.applyEnd)}</td>
                  <td className="px-3 py-3"><Chip size="sm" tone={s.tone}>{s.label}</Chip></td>
                  <td className="px-3 py-3">
                    <Chip size="sm" tone={a.reviewStatus === "ready" ? "ok" : "info"}>
                      {a.reviewStatus === "ready" ? "정리됨" : "정리 중"}
                    </Chip>
                  </td>
                  <td className="px-3 py-3 text-right tnum text-ink-2">
                    {a.eligibility.length + a.scoreRules.length}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/announcements/new?id=${a.id}`} className="text-sm font-semibold text-brand">
                      편집
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </Container>
  );
}
