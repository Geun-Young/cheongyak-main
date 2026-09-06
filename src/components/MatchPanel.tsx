"use client";

import { Check, X } from "lucide-react";
import type { Announcement, SupplyUnit } from "@/lib/types";
import { deriveFacts, useProfile } from "@/lib/profile";
import { useGuestProfile } from "@/lib/guest";
import { checkCondition, matchUnit } from "@/lib/matching";
import { describeFact } from "@/lib/fields";
import { StatusBadge } from "./StatusBadge";
import { RequestReviewButton } from "./RequestReviewButton";
import { ButtonLink, Card, cx } from "./ui";

export function MatchPanel({ a, unit }: { a: Announcement; unit: SupplyUnit }) {
  const { profile } = useProfile();
  const guest = useGuestProfile();
  const p = profile ?? guest;

  if (!p) {
    return (
      <Card className="border-brand/30 bg-brand-tint">
        <p className="text-lg font-bold text-ink">내 조건으로 판정해 볼까요?</p>
        <p className="mt-1 text-sm text-ink-2">
          지역·나이·소득 구간만 고르면 이 공고에 신청할 수 있는지, 몇 순위인지 바로 계산해요. 가입은 필요 없어요.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href="/#quick">조건 입력하고 판정 보기</ButtonLink>
          <ButtonLink href="/login" variant="secondary">로그인</ButtonLink>
        </div>
      </Card>
    );
  }

  const facts = deriveFacts(p);
  const r = matchUnit(a, unit, facts);
  const isGuest = !profile;

  return (
    <div className="space-y-4">
      <Card className={cx(
        r.status === "eligible" && "border-ok/30",
        r.status === "ineligible" && "border-warn/30",
      )}>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={r.status} />
          {a.reviewStatus === "recheck" && (
            <span className="rounded-full bg-info-soft px-2.5 py-1 text-[12px] font-semibold text-info">
              변경됨
            </span>
          )}
          <span className="text-sm text-ink-3">
            {isGuest ? "빠른 필터로 입력한 임시 조건 기준" : `${p.name}님 정보 기준`}
          </span>
        </div>
        {a.reviewStatus === "recheck" && r.status !== "needs_review" && (
          <p className="mt-2 text-sm text-info">
            공고 내용이 바뀌어 다시 확인 중이에요. 위 판정은 이전 조건 기준이니 원문도 함께 확인하세요.
          </p>
        )}

        {r.status === "eligible" && (
          <div className="mt-3">
            <p className="text-xl font-bold text-ink">신청할 수 있어요.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.tier && (
                <div className="min-w-28 rounded-lg bg-ok-soft px-3.5 py-2">
                  <p className="text-[12px] font-semibold text-ok">예상 순위</p>
                  <p className="text-xl font-extrabold leading-tight text-ok tnum">{r.tier.rank}순위</p>
                </div>
              )}
              {r.maxPoints > 0 && (
                <div className="min-w-28 rounded-lg bg-ground px-3.5 py-2">
                  <p className="text-[12px] font-semibold text-ink-3">가점</p>
                  <p className="text-xl font-extrabold leading-tight text-ink tnum">
                    {r.points}
                    <span className="text-sm font-semibold text-ink-3"> / {r.maxPoints}점</span>
                  </p>
                </div>
              )}
            </div>
            <p className="mt-3 text-sm text-ink-2">
              {r.tier ? `순위 기준: ${r.tier.label}. ` : ""}
              {unit.rankingMethod === "추첨제" ? "같은 순위 안에서는 추첨으로 뽑아요." : "같은 순위 안에서는 가점이 높은 순서예요."}
            </p>
          </div>
        )}

        {r.status === "ineligible" && (
          <div className="mt-3">
            <p className="text-xl font-bold text-ink">지금은 조건이 맞지 않아요.</p>
            <ul className="mt-2 space-y-1.5">
              {r.unmet.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-[15px]">
                  <X size={18} className="mt-0.5 shrink-0 text-warn" strokeWidth={2.6} />
                  <span>
                    <span className="font-semibold text-ink">{c.label}</span>
                    <span className="text-ink-3"> · 내 정보: {describeFact(c.field, facts[c.field])}</span>
                    {c.help && <span className="block text-[13px] text-ink-3">{c.help}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {r.status === "needs_review" && (
          <div className="mt-3">
            <p className="text-xl font-bold text-ink">조건을 정리하고 있어요.</p>
            <p className="mt-1 text-sm text-ink-2">
              접수기간·임대료는 확인됐어요. 자격 요건과 배점표는 아직 구조화하는 중이에요. 정리되면 알림으로 판정을 보내드릴게요.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ButtonLink href={a.originalUrl} external>원문 공고문에서 자격요건 확인하기</ButtonLink>
              {!isGuest && <RequestReviewButton announcementId={a.id} />}
            </div>
          </div>
        )}

        {r.status === "closed" && (
          <div className="mt-3">
            <p className="text-xl font-bold text-ink">접수가 끝난 공고예요.</p>
            <p className="mt-1 text-sm text-ink-2">비슷한 공고가 올라오면 알려드릴게요.</p>
          </div>
        )}
      </Card>

      {unit.eligibility.length > 0 && r.status !== "closed" && (
        <Card>
          <h3 className="text-base font-bold text-ink">자격 요건 체크</h3>
          <ul className="mt-3 divide-y divide-line">
            {unit.eligibility.map((c) => {
              const ok = checkCondition(c, facts);
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className={cx("grid size-6 place-items-center rounded-full", ok ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>
                      {ok ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
                    </span>
                    <span className="text-[15px] text-ink">{c.label}</span>
                  </span>
                  <span className="shrink-0 text-sm text-ink-3">내 정보: {describeFact(c.field, facts[c.field])}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {unit.tiers.length > 0 && r.status === "eligible" && (
        <Card>
          <h3 className="text-base font-bold text-ink">순위는 이렇게 갈려요</h3>
          <ol className="mt-3 space-y-2">
            {unit.tiers.map((t) => {
              const mine = r.tier?.rank === t.rank && r.tier?.label === t.label;
              return (
                <li key={`${t.rank}-${t.label}`} className={cx("flex items-center gap-3 rounded-md border px-3 py-2.5", mine ? "border-ok bg-ok-soft" : "border-line")}>
                  <span className={cx("grid size-8 shrink-0 place-items-center rounded-md text-sm font-extrabold tnum", mine ? "bg-ok text-white" : "bg-ground text-ink-2")}>
                    {t.rank}
                  </span>
                  <span className="flex-1 text-[15px] text-ink">{t.label}</span>
                  {mine && <span className="text-sm font-bold text-ok">내 순위</span>}
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {r.breakdown.length > 0 && (
        <Card>
          <h3 className="text-base font-bold text-ink">가점 내역</h3>
          <table className="mt-3 w-full text-[15px]">
            <tbody className="divide-y divide-line">
              {r.breakdown.map((l) => (
                <tr key={l.label}>
                  <td className="py-2.5 pr-3 text-ink">{l.label}</td>
                  <td className="py-2.5 pr-3 text-sm text-ink-3">{l.note}</td>
                  <td className="py-2.5 text-right font-bold tnum">
                    {l.points}
                    <span className="text-sm font-medium text-ink-3"> / {l.maxPoints}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line-strong">
                <td className="pt-2.5 font-bold" colSpan={2}>합계</td>
                <td className="pt-2.5 text-right text-lg font-extrabold text-brand tnum">
                  {r.points}
                  <span className="text-sm font-medium text-ink-3"> / {r.maxPoints}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      <p className="px-1 text-[13px] leading-relaxed text-ink-3">
        이 판정은 입력한 정보로 계산한 참고용이에요. 소득·자산은 공급기관이 사회보장정보시스템으로 세대원 전원을 합산 심사해요.
        최종 자격은 공고문과 기관 심사가 우선이에요.
      </p>
    </div>
  );
}
