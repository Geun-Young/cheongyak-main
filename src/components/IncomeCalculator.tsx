"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import {
  INCOME_100_BY_HOUSEHOLD,
  INCOME_TABLE_YEAR,
  baseIncome,
  bracketLabel,
  estimateFromIncome,
  estimateFromPremium,
  type IncomeEstimate,
} from "@/lib/income";
import { formatWon } from "@/lib/format";
import { Button, Chip, Field, Input, SegmentedControl, Select, cx } from "./ui";

type Mode = "premium" | "income";

export function IncomeCalculator({
  householdSize: initialHousehold = 1,
  onApply,
  compact = false,
}: {
  householdSize?: number;
  onApply?: (e: IncomeEstimate, householdSize: number) => void;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("premium");
  const [household, setHousehold] = useState(initialHousehold);
  const [insured, setInsured] = useState<"employee" | "regional">("employee");
  const [amount, setAmount] = useState("");

  const value = Number(amount.replace(/[^\d]/g, ""));
  const estimate = useMemo<IncomeEstimate | null>(() => {
    if (!value || value <= 0) return null;
    return mode === "premium"
      ? estimateFromPremium(value, household, insured)
      : estimateFromIncome(value, household);
  }, [mode, value, household, insured]);

  const base = baseIncome(household);

  return (
    <div className={cx("grid gap-5", !compact && "lg:grid-cols-[1fr_320px]")}>
      <div className="space-y-4">
        <SegmentedControl
          name="계산 방식"
          value={mode}
          onChange={setMode}
          options={[
            { value: "premium", label: "건강보험료로 계산" },
            { value: "income", label: "월 소득으로 계산" },
          ]}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="가구원 수" hint="주민등록등본에 함께 올라 있는 세대원 수예요. 태아는 공고마다 달라요.">
            <Select value={household} onChange={(e) => setHousehold(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n}인 가구</option>
              ))}
            </Select>
          </Field>

          {mode === "premium" ? (
            <Field label="가입 유형">
              <SegmentedControl
                name="건강보험 가입 유형"
                value={insured}
                onChange={setInsured}
                options={[
                  { value: "employee", label: "직장가입자" },
                  { value: "regional", label: "지역가입자" },
                ]}
              />
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>

        <Field
          label={mode === "premium" ? "월 건강보험료 본인부담금" : "세전 월 소득"}
          hint={
            mode === "premium"
              ? "장기요양보험료는 빼고, 건강보험료만 넣어요. 세대원이 여럿이면 각자 것을 더한 값을 넣어요."
              : "세대원 전원의 세전 월 소득을 합친 금액이에요. 상여금이 있으면 연 총액 ÷ 12로 넣어요."
          }
        >
          <div className="relative">
            <Input
              inputMode="numeric"
              placeholder={mode === "premium" ? "예: 128,000" : "예: 2,900,000"}
              value={amount}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, "");
                setAmount(digits ? Number(digits).toLocaleString("ko-KR") : "");
              }}
              className="pr-10 tnum"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">원</span>
          </div>
        </Field>

        {!compact && (
          <details className="rounded-md border border-line bg-surface-2 text-sm">
            <summary className="cursor-pointer px-3 py-2.5 font-semibold text-ink-2">
              {INCOME_TABLE_YEAR}년 적용 도시근로자 가구원수별 월평균소득(100%) 표
            </summary>
            <table className="w-full text-[13px]">
              <tbody>
                {Object.entries(INCOME_100_BY_HOUSEHOLD).map(([n, won]) => (
                  <tr key={n} className={cx("border-t border-line", Number(n) === household && "bg-brand-tint font-semibold")}>
                    <td className="px-3 py-1.5">{n}인 가구</td>
                    <td className="px-3 py-1.5 text-right tnum">{formatWon(won)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-[12px] text-ink-3">공고마다 적용 연도가 달라요. 공고문의 표를 우선해요.</p>
          </details>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface-2 p-5 lg:self-start">
        {estimate ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-ink-3">내 소득 구간</span>
              <Chip tone={estimate.confidence === "certain" ? "ok" : "warn"} size="sm">
                {estimate.confidence === "certain" ? "확실" : "추정"}
              </Chip>
            </div>
            <p className="mt-1 text-3xl font-extrabold text-ink tnum">{bracketLabel(estimate.bracket)}</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">환산 월 소득</dt>
                <dd className="font-semibold tnum">{formatWon(estimate.monthlyIncome)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">{household}인 가구 100% 기준</dt>
                <dd className="font-semibold tnum">{formatWon(base)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">기준 대비</dt>
                <dd className="font-semibold tnum">{estimate.pct.toFixed(1)}%</dd>
              </div>
            </dl>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{estimate.reason}</p>
            {onApply && (
              <Button className="mt-4 w-full" onClick={() => onApply(estimate, household)}>
                <Check size={16} strokeWidth={2.6} />
                이 구간으로 저장
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="font-semibold text-ink">금액을 넣으면 바로 계산돼요</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
              소득 금액은 저장하지 않아요. 계산된 구간(예: 100% 이하)만 저장돼요.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
