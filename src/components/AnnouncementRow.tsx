import Link from "next/link";
import { ChevronRight, CircleDashed, X } from "lucide-react";
import type { Announcement, AnnouncementMatchSummary } from "@/lib/types";
import { daysLeft, daysUntilStart, formatDate } from "@/lib/format";
import { countEligibleUnits } from "@/lib/matching";
import { AgencyMark } from "./AgencyMark";
import { StatusBadge } from "./StatusBadge";
import { Chip, cx } from "./ui";

function Deadline({ a }: { a: Announcement }) {
  const left = daysLeft(a.applyEnd);
  const untilStart = daysUntilStart(a.applyStart);

  if (left < 0) {
    return (
      <div className="text-right">
        <p className="font-semibold text-ink-3">접수 종료</p>
        <p className="text-[13px] text-ink-3 tnum">{formatDate(a.applyEnd)}</p>
      </div>
    );
  }
  if (untilStart > 0) {
    return (
      <div className="text-right">
        <p className="font-semibold text-ink-2 whitespace-nowrap">
          접수 시작까지 <span className="tnum">{untilStart}</span>일
        </p>
        <p className="text-[13px] text-ink-3 tnum">{formatDate(a.applyStart)} 시작</p>
      </div>
    );
  }
  const urgent = left <= 3;
  return (
    <div className="text-right">
      <p className={cx("font-semibold whitespace-nowrap", urgent ? "text-ink" : "text-ink-2")}>
        {left === 0 ? (
          <span className="text-danger">오늘 마감</span>
        ) : (
          <>
            마감까지 <span className={cx("tnum", urgent && "text-danger font-bold")}>{left}</span>일
          </>
        )}
      </p>
      <p className="text-[13px] text-ink-3 tnum">~ {formatDate(a.applyEnd)}</p>
    </div>
  );
}

function Result({ result }: { result?: AnnouncementMatchSummary["best"] }) {
  if (!result) {
    return <p className="text-sm text-ink-3">조건을 입력하면 판정해 드려요</p>;
  }
  switch (result.status) {
    case "eligible":
      return (
        <div className="flex flex-wrap items-baseline gap-x-2 md:block">
          <p className="font-bold text-ok">
            {result.tier ? `예상 ${result.tier.rank}순위` : "신청 대상"}
          </p>
          <p className="text-[13px] text-ink-2 tnum">
            {result.maxPoints > 0
              ? `가점 ${result.points}점 / 최대 ${result.maxPoints}점`
              : result.tier
                ? result.tier.label
                : "순위 안에서 추첨"}
          </p>
        </div>
      );
    case "ineligible":
      return (
        <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-ink-2 md:block md:space-y-0.5">
          {result.unmet.slice(0, 2).map((c) => (
            <li key={c.id} className="flex items-start gap-1">
              <X size={14} className="mt-0.5 shrink-0 text-warn" strokeWidth={2.5} />
              <span>{c.label}</span>
            </li>
          ))}
          {result.unmet.length > 2 && (
            <li className="text-ink-3 md:pl-[18px]">외 {result.unmet.length - 2}건</li>
          )}
        </ul>
      );
    case "needs_review":
      return (
        <div className="flex flex-wrap items-baseline gap-x-2 md:block">
          <p className="font-semibold text-ink-2">조건 정리 중</p>
          <p className="text-[13px] text-ink-3">정리되면 바로 알려드릴게요</p>
        </div>
      );
    case "closed":
      return <p className="text-sm text-ink-3">접수가 끝났어요</p>;
  }
}

/**
 * 목록의 한 행. 데스크탑은 6열 그리드(기관·제목·상태·판정·마감·화살표),
 * 모바일은 3줄(제목 / 상태+마감 / 판정)로 다시 배치한다.
 */
export function AnnouncementRow({ a, summary }: { a: Announcement; summary?: AnnouncementMatchSummary }) {
  const result = summary?.best;
  const { eligible, total } = summary ? countEligibleUnits(summary) : { eligible: 0, total: 0 };
  const showUnitBadge = total > 1;
  return (
    <Link
      href={`/announcements/${a.id}`}
      className="group block px-4 py-4 transition-colors hover:bg-surface-2 md:px-5"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-3 md:grid-cols-[48px_minmax(0,1fr)_108px_minmax(180px,220px)_128px_20px] md:items-center md:gap-4">
        <AgencyMark code={a.agency.code} className="col-start-1 row-start-1" />

        <div className="col-start-2 row-start-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="brand" size="sm">{a.housingType}</Chip>
            <h3 className="text-[16px] font-bold leading-snug text-ink md:text-[17px]">{a.title}</h3>
            {showUnitBadge && (
              <Chip size="sm" tone={eligible > 0 ? "ok" : "muted"}>
                {total}개 타입 중 {eligible}개 신청가능
              </Chip>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ink-3">
            <span>{a.agency.name.split(" ")[0]}</span>
            <span aria-hidden className="h-3 w-px bg-line-strong" />
            <span>{a.district}</span>
            <span aria-hidden className="h-3 w-px bg-line-strong" />
            <span className="tnum">총 {a.units.toLocaleString("ko-KR")}세대</span>
          </div>
          <p className="mt-1 hidden text-sm text-ink-2 md:line-clamp-1">{a.summary[0]}</p>
        </div>

        <ChevronRight className="col-start-3 row-start-1 mt-1 shrink-0 self-start text-ink-3 md:hidden" size={18} />

        <div className="col-span-3 col-start-1 row-start-2 flex items-center justify-between gap-3 md:contents">
          <div className="md:col-start-3 md:row-start-1">
            {result ? (
              <StatusBadge status={result.status} />
            ) : (
              <Chip tone="muted">
                <CircleDashed size={15} strokeWidth={2.4} />
                판정 전
              </Chip>
            )}
          </div>
          <div className="md:col-start-5 md:row-start-1">
            <Deadline a={a} />
          </div>
        </div>

        <div className="col-span-3 col-start-1 row-start-3 min-w-0 md:col-span-1 md:col-start-4 md:row-start-1">
          <Result result={result} />
        </div>

        <ChevronRight
          className="hidden shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 md:col-start-6 md:row-start-1 md:block"
          size={20}
        />
      </div>
    </Link>
  );
}
