"use client";

import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import type { AnnouncementRecommendation, UnitRecommendation } from "@/lib/recommend";
import { daysLeft } from "@/lib/format";
import { Card, Chip } from "./ui";

/**
 * 점수를 막대로 보여준다. 숫자만 쓰면 "84점이 좋은 건가?"를 판단하기 어렵다.
 * 같은 공고 안에서만 비교하는 상대 점수라는 점을 색으로도 구분한다.
 */
function ScoreBar({ score }: { score: number }) {
  const tone =
    score >= 70 ? "bg-ok" : score >= 50 ? "bg-brand" : score >= 35 ? "bg-warn" : "bg-ink-3";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ground">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(4, score)}%` }} />
      </div>
      <span className="tnum text-[13px] font-bold text-ink-2">{score}</span>
    </div>
  );
}

/** 한 집(단지) 한 줄. 이름·점수·한줄평과 근거를 보여준다 */
function UnitRow({ rec, rank }: { rec: UnitRecommendation; rank: number }) {
  const isTop = rank === 0;
  return (
    <li
      className={`rounded-lg border px-3 py-2.5 ${
        isTop ? "border-brand/40 bg-brand-tint" : "border-line bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {isTop && (
            <Chip size="sm" tone="brand">
              추천
            </Chip>
          )}
          <span className="truncate text-[15px] font-bold text-ink">{rec.unit.name}</span>
          {rec.unit.unitsCount > 0 && (
            <span className="shrink-0 text-[12px] text-ink-3 tnum">{rec.unit.unitsCount}세대</span>
          )}
        </div>
        <ScoreBar score={rec.score} />
      </div>

      <p className="mt-1.5 text-[14px] font-semibold text-brand-deep">{rec.headline}</p>

      {rec.reasons.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {rec.reasons.slice(0, 3).map((r) => (
            <li key={r} className="text-[13px] leading-relaxed text-ink-2">
              · {r}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * 공고 하나에 대한 추천. 공고 안에 집이 여러 개면 그중 어디가 나에게 맞는지 순서를 보여준다.
 *
 * 집이 하나뿐인 공고도 카드를 만든다 — 그 하나가 나에게 맞는지(점수·한줄평)는
 * 여전히 알고 싶은 정보다. 다만 "여러 집 중 고르기" 문구는 빼서 오해를 줄인다.
 */
export function RecommendCard({ rec }: { rec: AnnouncementRecommendation }) {
  const a = rec.announcement;
  const left = daysLeft(a.applyEnd);
  const many = rec.ranked.length > 1;
  // 집이 많으면 상위 3개만 먼저 보여준다 — 13개를 그대로 쏟으면 고르기가 더 어려워진다.
  const shown = rec.ranked.slice(0, 3);
  const hidden = rec.ranked.length - shown.length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {a.region && (
              <Chip size="sm" tone="muted">
                {a.region}
              </Chip>
            )}
            {a.areaLabel && (
              <Chip size="sm" tone="muted">
                {a.areaLabel}
              </Chip>
            )}
            <Chip size="sm" tone={left <= 3 ? "danger" : left <= 7 ? "warn" : "info"}>
              {left === 0 ? "오늘 마감" : `D-${left}`}
            </Chip>
          </div>
          <Link
            href={`/announcements/${a.id}`}
            className="mt-1.5 block text-[16px] font-bold text-ink hover:text-brand"
          >
            {a.title}
          </Link>
        </div>
      </div>

      {many && (
        <p className="mt-3 text-[13px] text-ink-2">
          이 공고에 집이 <strong className="text-ink">{rec.ranked.length}개</strong> 있어요.
          조건에 맞는 순서로 보여드려요.
        </p>
      )}

      <ul className={`space-y-2 ${many ? "mt-2" : "mt-3"}`}>
        {shown.map((u, i) => (
          <UnitRow key={u.unitId} rec={u} rank={i} />
        ))}
      </ul>

      {hidden > 0 && (
        <Link
          href={`/announcements/${a.id}`}
          className="mt-2 inline-flex items-center gap-0.5 text-[13px] font-semibold text-brand hover:underline"
        >
          나머지 {hidden}개 집도 보기 <ChevronRight size={14} />
        </Link>
      )}
    </Card>
  );
}

/**
 * 추천 목록 전체.
 *
 * 비어 있을 때 그냥 "없어요"로 끝내지 않는다 — 지역을 좁게 골랐거나 조건이 안 맞는 것이
 * 대부분이라, 무엇을 바꾸면 되는지 알려줘야 막다른 길이 되지 않는다.
 */
export function RecommendPanel({
  recommendations,
  regionFiltered,
  onShowAll,
}: {
  recommendations: AnnouncementRecommendation[];
  /** 지역 필터가 걸려 있는지. 결과가 없을 때 안내를 다르게 한다 */
  regionFiltered: boolean;
  onShowAll?: () => void;
}) {
  if (recommendations.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-ink-3" />
          <h2 className="text-[16px] font-bold text-ink">아직 추천할 집이 없어요</h2>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          {regionFiltered
            ? "고르신 지역에 지금 신청할 수 있는 공고가 없어요. 관심 지역을 넓히거나 전체 공고를 보시면 더 많이 나와요."
            : "지금 조건으로 신청 가능한 공고가 없어요. 내 정보를 다시 확인하거나, 새 공고가 올라오면 알려드릴게요."}
        </p>
        {regionFiltered && onShowAll && (
          <button
            type="button"
            onClick={onShowAll}
            className="mt-3 h-9 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-2"
          >
            전체 지역 보기
          </button>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map((rec) => (
        <RecommendCard key={rec.announcementId} rec={rec} />
      ))}
    </div>
  );
}
