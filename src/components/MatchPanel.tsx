"use client";

import { Check, Info, X } from "lucide-react";
import type { Announcement, SupplyUnit } from "@/lib/types";
import { deriveFacts, useProfile } from "@/lib/profile";
import { useGuestProfile } from "@/lib/guest";
import { useSpecialGroups } from "@/lib/special-groups-store";
import { STATUS_META, checkCondition, matchUnit, matchUnitVariants } from "@/lib/matching";
import { mentionsSpecialGroup } from "@/lib/special-groups";
import { SpecialGroupPicker } from "./SpecialGroupPicker";
import { computeGajeom, gajeomFromProfile, GAJEOM_MAX } from "@/lib/gajeom";
import { gajeomRatio } from "@/lib/rules/sale-rules";
import { describeFact } from "@/lib/fields";
import { StatusBadge } from "./StatusBadge";
import { RequestReviewButton } from "./RequestReviewButton";
import { ButtonLink, Card, cx } from "./ui";

const toneCls = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  info: "bg-info-soft text-info",
  muted: "bg-ground text-ink-3",
} as const;

export function MatchPanel({ a, unit }: { a: Announcement; unit: SupplyUnit }) {
  const { profile } = useProfile();
  const guest = useGuestProfile();
  const [groups] = useSpecialGroups();
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

  const facts = deriveFacts(p, undefined, groups);
  const r = matchUnit(a, unit, facts);
  const isGuest = !profile;
  // 신청 경로(주택형·계층)가 있으면 아래 조건·순위 카드는 이 결과를 낸 경로의 것을 보여 준다
  const rules = r.variant && unit.variants ? unit.variants[r.variant.index] : unit;
  const variantResults = unit.variants?.length ? matchUnitVariants(a, unit, facts) : null;
  // 민영 1순위는 가점으로 뽑는다 — 정보를 입력한 회원은 프로필로 가점을 계산해 보여 준다(빠른 필터 값은 임의값이라 쓰지 않는다)
  const privateSale = unit.sale && a.sale?.kind === "민영" ? { sale: a.sale, unit: unit.sale } : null;
  const gajeom =
    privateSale && profile?.onboardingDone
      ? (() => {
          const f = gajeomFromProfile(profile).input;
          return computeGajeom({
            homeless: f.homeless ?? true,
            homelessYears: f.homelessYears ?? 0,
            dependents: f.dependents ?? 0,
            accountMonths: f.accountMonths ?? null,
          });
        })()
      : null;
  // 순위나 신청 경로가 수급자·장애인 같은 신분으로 갈리는 공고면, 여기서 바로 체크할 수 있게 한다
  const groupSensitive =
    rules.tiers.some((t) => mentionsSpecialGroup(t.label)) || (unit.variants ?? []).some((v) => mentionsSpecialGroup(v.name));

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
            {/* 빠른 필터는 통장을 묻지 않고 가정한다(profile-data.ts profileFromQuery) — 분양 순위가 이 가정에 좌우된다 */}
            {isGuest && a.sale && <span className="block text-[12px]">청약통장은 3년 가입·360만 원으로 가정했어요. 정보 입력에서 실제 값을 넣으면 정확해져요.</span>}
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
            {r.variant && (
              <p className="mt-1 text-[15px] text-ink-2">
                신청 경로: <span className="font-semibold text-ink">{r.variant.name}</span>
              </p>
            )}
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
            {r.variant && (
              <p className="mt-1 text-[15px] text-ink-2">
                가장 가까운 경로: <span className="font-semibold text-ink">{r.variant.name}</span>
              </p>
            )}
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

        {r.status === "needs_review" && r.variant && (
          <div className="mt-3">
            <p className="text-xl font-bold text-ink">대상에 해당하면 신청할 수 있어요.</p>
            <p className="mt-1 text-sm text-ink-2">
              일반 경로로는 조건이 맞지 않지만 <span className="font-semibold text-ink">{r.variant.name}</span> 경로로는
              넣을 수 있어요. 이 대상인지는 입력하신 정보로 알 수 없어서, 아래 조건을 공고문에서 확인하세요.
            </p>
          </div>
        )}

        {r.status === "needs_review" && !r.variant && (
          <div className="mt-3">
            <p className="text-xl font-bold text-ink">조건을 정리하고 있어요.</p>
            <p className="mt-1 text-sm text-ink-2">
              {a.sale
                ? "접수 일정과 분양가는 확인됐어요. 공공분양·신혼희망타운 자격 판정은 준비 중이에요. 공고문에서 자격을 확인하세요."
                : "접수기간·임대료는 확인됐어요. 자격 요건과 배점표는 아직 구조화하는 중이에요. 정리되면 알림으로 판정을 보내드릴게요."}
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

      {variantResults && r.status !== "closed" && (
        <Card>
          <h3 className="text-base font-bold text-ink">{a.sale ? "일반공급·특별공급 중 하나로 신청해요" : "주택형·계층마다 조건이 달라요"}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            {a.sale
              ? "하나라도 되면 신청할 수 있어요. 특별공급은 평생 한 번만 당첨될 수 있어요."
              : "이 단지는 아래 중 하나를 골라 신청해요. 하나라도 되면 신청할 수 있어요. 단지마다 어떤 주택형이 있는지는 공고문에서 확인하세요."}
          </p>
          <ul className="mt-3 divide-y divide-line">
            {variantResults.map((v) => {
              const meta = STATUS_META[v.status];
              const mine = v.variant?.index === r.variant?.index;
              return (
                <li key={v.variant?.index} className="flex items-center justify-between gap-3 py-2.5">
                  <span className={cx("min-w-0 text-[15px]", mine ? "font-semibold text-ink" : "text-ink-2")}>
                    {v.variant?.name}
                    {v.status === "ineligible" && v.unmet[0] && (
                      <span className="block text-[13px] font-normal text-ink-3">미달: {v.unmet[0].label}</span>
                    )}
                  </span>
                  <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold", toneCls[meta.tone])}>
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {privateSale && r.status !== "closed" && (
        <Card>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-base font-bold text-ink">청약 가점</h3>
            {gajeom && (
              <p className="text-ink">
                <span className="text-2xl font-extrabold tnum">{gajeom.total}</span>
                <span className="text-sm font-semibold text-ink-3"> / {GAJEOM_MAX.total}점</span>
              </p>
            )}
          </div>
          {gajeom ? (
            <ul className="mt-2 space-y-1 text-[14px]">
              {gajeom.lines.map((l) => (
                <li key={l.key} className="flex justify-between gap-3">
                  <span className="text-ink-2">{l.label} <span className="text-ink-3">· {l.note}</span></span>
                  <span className="font-semibold tnum">{l.points} / {l.max}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[14px] text-ink-2">정보 입력을 마치면 내 가점(84점 만점)을 여기서 계산해 드려요.</p>
          )}
          <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
            이 주택형(전용 {privateSale.unit.areaM2 ?? "?"}㎡)은 1순위끼리 {gajeomRatio(privateSale.sale, privateSale.unit.areaM2)}로 뽑아요.
          </p>
          <ButtonLink href="/tools/gajeom" variant="secondary" size="sm" className="mt-3">
            가점 계산기에서 자세히 보기
          </ButtonLink>
        </Card>
      )}

      {groupSensitive && r.status !== "closed" && (
        <Card>
          <h3 className="text-base font-bold text-ink">이 공고는 대상 계층에 따라 순위·자격이 갈려요</h3>
          <p className="mt-1 mb-3 text-[13px] leading-relaxed text-ink-2">
            체크하면 순위와 신청 가능 여부에 바로 반영돼요. 체크하지 않으면 해당하지 않는 것으로 보고 계산해요.
          </p>
          <SpecialGroupPicker title="해당하는 게 있나요?" />
        </Card>
      )}

      {rules.eligibility.length > 0 && r.status !== "closed" && (
        <Card>
          <h3 className="text-base font-bold text-ink">자격 요건 체크{r.variant ? ` · ${r.variant.name}` : ""}</h3>
          <ul className="mt-3 divide-y divide-line">
            {rules.eligibility.map((c) => {
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

      {rules.otherRequirements && rules.otherRequirements.length > 0 && r.status !== "closed" && (
        <Card className="border-warn/30">
          <h3 className="text-base font-bold text-ink">직접 확인이 필요한 조건</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            아래 조건은 입력하신 정보로는 자동으로 확인할 수 없어요. 해당되는지 공고문에서 꼭 확인하세요.
          </p>
          <ul className="mt-3 space-y-2.5">
            {rules.otherRequirements.map((o, i) => (
              <li key={i} className="flex items-start gap-2">
                <Info size={17} className="mt-0.5 shrink-0 text-warn" strokeWidth={2.2} />
                <span>
                  <span className="text-[15px] text-ink">{o.label}</span>
                  {o.detail && <span className="block text-[13px] leading-snug text-ink-3">{o.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {rules.tiers.length > 0 && r.status === "eligible" && (
        <Card>
          <h3 className="text-base font-bold text-ink">순위는 이렇게 갈려요</h3>
          <ol className="mt-3 space-y-2">
            {rules.tiers.map((t) => {
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
