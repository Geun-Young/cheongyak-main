import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getAnnouncementById } from "@/lib/data/announcements";
import { displaySummary } from "@/lib/announcement-display";
import { daysLeft, daysUntilStart, formatDate } from "@/lib/format";
import { HOUSING_TYPE_HINT } from "@/lib/regions";
import { AgencyMark } from "@/components/AgencyMark";
import { SupplyUnitPicker } from "@/components/SupplyUnitPicker";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ButtonLink, Card, Chip, Container, cx } from "@/components/ui";

export async function generateMetadata(props: PageProps<"/announcements/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const a = await getAnnouncementById(id);
  return { title: a ? a.title : "공고를 찾을 수 없어요" };
}

function DeadlineBlock({ end, start }: { end: string; start: string }) {
  const left = daysLeft(end);
  const untilStart = daysUntilStart(start);
  let headline: React.ReactNode;
  let tone = "text-ink";
  if (left < 0) {
    headline = "접수 종료";
    tone = "text-ink-3";
  } else if (untilStart > 0) {
    headline = <>접수 시작까지 <span className="tnum">{untilStart}</span>일</>;
  } else if (left === 0) {
    headline = "오늘 마감";
    tone = "text-danger";
  } else {
    headline = <>마감까지 <span className="tnum">{left}</span>일</>;
    tone = left <= 3 ? "text-danger" : "text-ink";
  }
  return (
    <div className="shrink-0 rounded-lg bg-ground px-4 py-3 md:text-right">
      <p className={cx("text-xl font-extrabold whitespace-nowrap", tone)}>{headline}</p>
      <p className="text-[13px] text-ink-3 tnum whitespace-nowrap">
        {formatDate(start)} ~ {formatDate(end)}
      </p>
    </div>
  );
}

export default async function AnnouncementDetailPage(props: PageProps<"/announcements/[id]">) {
  const { id } = await props.params;
  const a = await getAnnouncementById(id);
  if (!a) notFound();
  const urlKind = a.originalUrlKind ?? "notice";

  return (
    <Container className="py-6 md:py-10">
      <Link href="/announcements" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-3 hover:text-brand">
        <ArrowLeft size={16} /> 공고 목록
      </Link>

      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[auto_1fr] lg:items-start">
        <Card className="lg:col-start-1 lg:row-start-1">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <AgencyMark code={a.agency.code} size="lg" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="brand" size="sm">{a.housingType}</Chip>
                  <Chip size="sm">{a.rankingMethod}</Chip>
                  {a.status === "closed" && <Chip size="sm">마감</Chip>}
                </div>
                <h1 className="mt-2 text-[22px] font-bold leading-snug text-ink md:text-[26px]">{a.title}</h1>
                <p className="mt-1.5 text-[15px] text-ink-2">
                  {a.agency.name} · {a.district} · 총 <span className="tnum">{a.units.toLocaleString("ko-KR")}</span>세대
                </p>
              </div>
            </div>
            <DeadlineBlock end={a.applyEnd} start={a.applyStart} />
          </div>
        </Card>

        <aside className="space-y-3 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start">
          <SupplyUnitPicker a={a} />
          <div className="flex flex-wrap gap-2">
            <FavoriteButton id={a.id} />
            <ButtonLink href={a.originalUrl} external variant="secondary">
              {urlKind === "notice" ? "공고문 원문 보기" : urlKind === "list" ? "기관 공고 목록에서 찾기" : "기관 사이트 열기"}
              <ExternalLink size={16} />
            </ButtonLink>
          </div>
          {urlKind !== "notice" && (
            <p className="px-1 text-[13px] leading-relaxed text-ink-3">
              지금은 목업 데이터라 공고문 원문 대신 {a.agency.name.split(" ")[0]}의 {urlKind === "list" ? "공고 목록" : "홈페이지"}으로
              이동해요. 공공데이터 연동 후에는 공고마다 원문 링크가 자동으로 붙어요.
            </p>
          )}
        </aside>

        <div className="space-y-5 lg:col-start-1 lg:row-start-2">
        <Card>
          <h2 className="text-lg font-bold text-ink">핵심만 정리하면</h2>
          <ul className="mt-3 space-y-2.5">
            {displaySummary(a).map((s) => (
              <li key={s} className="flex gap-3 text-[15px] leading-relaxed text-ink">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-md bg-surface-2 px-3 py-2 text-[13px] text-ink-3">
            {a.housingType}: {HOUSING_TYPE_HINT[a.housingType]}
          </p>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-ink">일정</h2>
          <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b border-line pb-2.5">
              <dt className="text-ink-3">공고일</dt>
              <dd className="font-semibold tnum">{formatDate(a.announcedAt)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-line pb-2.5">
              <dt className="text-ink-3">접수 기간</dt>
              <dd className="font-semibold tnum">{formatDate(a.applyStart)} ~ {formatDate(a.applyEnd)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-line pb-2.5 sm:col-span-2">
              <dt className="text-ink-3">순위 산정</dt>
              <dd className="font-semibold">{a.rankingMethod}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[13px] text-ink-3">
            입주 예정·임대 조건·위치는 유닛마다 달라서 오른쪽 판정 카드에 유닛별로 표시돼요.
            정리한 내용과 공고문이 다르면 공고문이 맞아요. 원문 링크에서 꼭 다시 확인하세요.
          </p>
        </Card>
        </div>
      </div>
    </Container>
  );
}
