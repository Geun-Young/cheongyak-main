"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useProfile } from "@/lib/profile";
import {
  GAJEOM_MAX,
  computeGajeom,
  gajeomFromProfile,
  type GajeomKey,
  type GajeomLine,
} from "@/lib/gajeom";
import { DEPOSIT_AREAS, DEPOSIT_CLASSES, DEPOSIT_TABLE, depositClass } from "@/lib/deposit";
import { formatManwon } from "@/lib/format";
import { Button, Card, Select, cx } from "./ui";

/** 통장 가입 기간 눈금: 0=통장 없음, 1=6개월 미만, 2=6개월~1년, 3..17 = 1..15년 */
const ACC_MONTHS: (number | null)[] = [null, 0, 6, ...Array.from({ length: 15 }, (_, i) => (i + 1) * 12)];
const accLabel = (i: number) =>
  i === 0 ? "통장 없음" : i === 1 ? "6개월 미만" : i === 2 ? "6개월~1년" : i === 17 ? "15년 이상" : `${i - 2}년`;
const accIndexOf = (m: number | null) => (m == null ? 0 : m < 6 ? 1 : m < 12 ? 2 : Math.min(17, 2 + Math.floor(m / 12)));
const homeLabel = (v: number) => (v === 0 ? "1년 미만" : v === 15 ? "15년 이상" : `${v}년`);
const SHORT: Record<GajeomKey, string> = { homeless: "무주택", dependents: "부양가족", account: "통장" };

/** 온보딩을 마친 프로필만 쓴다. 빠른 필터(게스트) 프로필은 가입일 등을 임의값으로 채워서 가점에 쓰면 틀린다 */
function useFilledProfile() {
  const { profile } = useProfile();
  return profile?.onboardingDone ? profile : null;
}

function Slider({
  id,
  label,
  value,
  max,
  onChange,
  text,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  text: string;
  disabled?: boolean;
}) {
  return (
    <div className={cx(disabled && "opacity-40")}>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[15px] font-semibold text-ink">
          {label}
        </label>
        <span className="text-[15px] font-bold text-brand tnum">{text}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        aria-valuetext={text}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-6 w-full cursor-pointer accent-brand disabled:cursor-not-allowed"
      />
    </div>
  );
}

/** 84칸 눈금자. 1점 = 1칸, 무주택 32 · 부양가족 35 · 통장 17 세 묶음이 가점표 구조 그대로 놓인다 */
function Ruler({ lines }: { lines: GajeomLine[] }) {
  return (
    <div className="flex gap-2 sm:gap-3">
      {lines.map((l) => (
        <div key={l.key} className="min-w-0" style={{ flex: `${l.max} 1 0` }}>
          <p className="truncate text-[13px] font-semibold text-ink-3">{SHORT[l.key]}</p>
          <p className="text-[15px] font-bold text-ink tnum">
            {l.points}
            <span className="font-medium text-ink-3">/{l.max}</span>
          </p>
          <div className="mt-1.5 flex h-8 gap-px" role="img" aria-label={`${l.label} ${l.points}점 / ${l.max}점`}>
            {Array.from({ length: l.max }, (_, k) => (
              <span
                key={k}
                className={cx("h-full flex-1 rounded-[1.5px] transition-colors duration-200", k < l.points ? "bg-brand" : "bg-line")}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 민영주택 청약 가점(84점) 계산기. 청약핏(chan-hee1102/myhome)의 GajeomCalc를 이 프로젝트 UI로 옮겼다.
 * 조건을 저장한 사람은 「내 정보로 채우기」로 프로필에서 만 30세·혼인신고일 규칙을 적용한 값을 불러온다.
 */
export function GajeomCalculator() {
  const p = useFilledProfile();
  const [homeless, setHomeless] = useState(true);
  const [homelessYears, setHomelessYears] = useState(7);
  const [dependents, setDependents] = useState(2);
  const [accIdx, setAccIdx] = useState(8);
  const [spouseIdx, setSpouseIdx] = useState(0);
  // 프로필에서 채운 근거. 사용자가 그 칸을 직접 바꾸면 근거가 틀려지므로 지운다
  const [notes, setNotes] = useState<Partial<Record<GajeomKey, string>> | null>(null);

  const { total, lines } = computeGajeom({
    homeless,
    homelessYears,
    dependents,
    accountMonths: ACC_MONTHS[accIdx],
    spouseAccountMonths: ACC_MONTHS[spouseIdx],
  });

  const dropNote = (key: GajeomKey) => setNotes((n) => (n ? { ...n, [key]: undefined } : n));

  const fill = () => {
    if (!p) return;
    const f = gajeomFromProfile(p);
    if (f.input.homeless !== undefined) setHomeless(f.input.homeless);
    if (f.input.homelessYears !== undefined) setHomelessYears(Math.max(0, Math.min(15, Math.floor(f.input.homelessYears))));
    if (f.input.dependents !== undefined) setDependents(Math.min(6, f.input.dependents));
    if (f.input.accountMonths !== undefined) setAccIdx(accIndexOf(f.input.accountMonths));
    setNotes(f.notes);
  };

  const noteList = notes ? lines.filter((l) => notes[l.key]) : [];

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-sm font-semibold text-ink-3">{notes ? "내 정보로 계산한 가점" : "청약 가점"}</p>
          <p className="mt-1 text-ink">
            <span className="text-[40px] font-extrabold leading-none tnum">{total}</span>
            <span className="ml-1.5 text-lg font-semibold text-ink-3">/ {GAJEOM_MAX.total}점</span>
          </p>
        </div>
        {p && !notes && (
          <Button variant="secondary" size="sm" onClick={fill}>
            내 정보로 채우기
          </Button>
        )}
      </div>

      <div className="mt-5">
        <Ruler lines={lines} />
      </div>

      <div className="mt-7 space-y-6">
        <div>
          <Slider
            id="gj-homeless"
            label="무주택 기간"
            value={homelessYears}
            max={15}
            onChange={(v) => {
              setHomelessYears(v);
              dropNote("homeless");
            }}
            text={homeless ? homeLabel(homelessYears) : "0점"}
            disabled={!homeless}
          />
          <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] text-ink-2">
            <input
              type="checkbox"
              checked={!homeless}
              onChange={(e) => {
                setHomeless(!e.target.checked);
                dropNote("homeless");
              }}
              className="size-5 accent-brand"
            />
            무주택 0점 (집이 있거나 만 30세 전 미혼)
          </label>
        </div>
        <Slider
          id="gj-dep"
          label="부양가족 (본인 제외)"
          value={dependents}
          max={6}
          onChange={(v) => {
            setDependents(v);
            dropNote("dependents");
          }}
          text={dependents === 6 ? "6명 이상" : `${dependents}명`}
        />
        <Slider
          id="gj-acc"
          label="청약통장 가입 기간"
          value={accIdx}
          max={17}
          onChange={(v) => {
            setAccIdx(v);
            dropNote("account");
          }}
          text={accLabel(accIdx)}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gj-spouse" className="text-[15px] font-semibold text-ink">
            배우자 청약통장 가입 기간
          </label>
          <Select id="gj-spouse" value={spouseIdx} onChange={(e) => setSpouseIdx(Number(e.target.value))}>
            {ACC_MONTHS.map((_, i) => (
              <option key={i} value={i}>
                {i === 0 ? "배우자 통장 없음" : accLabel(i)}
              </option>
            ))}
          </Select>
          <p className="text-[13px] leading-snug text-ink-3">
            배우자 통장 가입 기간 점수의 절반(최대 3점)을 더해요. 통장 점수는 합쳐도 17점까지예요.
          </p>
        </div>
      </div>

      {noteList.length > 0 && (
        <div className="mt-6 rounded-md bg-brand-tint px-4 py-3">
          <p className="text-sm font-bold text-ink">내 정보에서 이렇게 셌어요</p>
          <dl className="mt-2 space-y-1.5 text-[14px] leading-relaxed">
            {noteList.map((l) => (
              <div key={l.key}>
                <dt className="inline font-semibold text-ink">{l.label}: </dt>
                <dd className="inline text-ink-2">{notes?.[l.key]}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <p className="mt-6 border-t border-line pt-4 text-[13px] leading-relaxed text-ink-3">
        무주택 기간은 만 30세부터 세요. 그 전에 결혼했다면 혼인신고일부터예요. 가점은 민영 아파트 일반공급에서 쓰고,
        공공임대·공공분양은 순위와 배점표로 뽑아요.
      </p>
    </Card>
  );
}

/**
 * 민영주택 1순위 예치금 표. 가점이 높아도 1순위가 아니면 가점제로 뽑히지 않는다.
 * 저장된 조건이 있으면 내 거주지 줄을 강조하고, 통장 납입 총액과 비교해 부족분을 보여준다.
 */
export function DepositTable() {
  const p = useFilledProfile();
  const mine = p ? depositClass(p.residenceRegion) : null;
  const balance = p?.hasSubscription ? p.totalDeposit : null;

  return (
    <Card>
      <h2 className="text-lg font-bold text-ink">민영 아파트 1순위 예치금</h2>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
        가점이 높아도 1순위가 아니면 가점으로 뽑히지 않아요. 입주자모집공고일에 청약통장에 아래 금액 이상이 들어 있어야
        해요. 기준은 공고 지역이 아니라 내 주민등록 주소예요.
      </p>

      <table className="mt-4 w-full text-[14px]">
        <caption className="pb-1.5 text-right text-[12px] text-ink-3">단위: 만 원 · 전용면적 기준</caption>
        <thead>
          <tr className="border-b border-line-strong text-ink-3">
            <th scope="col" className="py-2 pr-2 text-left font-semibold">거주지</th>
            {DEPOSIT_AREAS.map((a) => (
              <th key={a.key} scope="col" className="px-1 py-2 text-right font-semibold">
                {a.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DEPOSIT_CLASSES.map((c) => (
            <tr key={c.key} className={cx("border-b border-line", mine === c.key && "bg-brand-tint font-semibold")}>
              <th scope="row" className="py-2.5 pr-2 text-left font-semibold text-ink">
                {c.label}
                {mine === c.key && <span className="block text-[12px] font-bold text-brand">내 거주지</span>}
              </th>
              {DEPOSIT_AREAS.map((a) => (
                <td key={a.key} className="px-1 py-2.5 text-right text-ink tnum">
                  {DEPOSIT_TABLE[c.key][a.key].toLocaleString("ko-KR")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {p && mine && balance !== null && (
        <div className="mt-4 rounded-md bg-surface-2 px-4 py-3">
          <p className="text-sm font-bold text-ink">
            내 통장 {formatManwon(balance)} 기준 ({p.residenceRegion} 거주)
          </p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {DEPOSIT_AREAS.map((a) => {
              const need = DEPOSIT_TABLE[mine][a.key];
              const ok = balance >= need;
              return (
                <li key={a.key} className="flex items-center gap-2 text-[14px]">
                  <span className={cx("grid size-5 shrink-0 place-items-center rounded-full", ok ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>
                    {ok ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                  </span>
                  <span className="text-ink">{a.label}</span>
                  <span className={cx("ml-auto tnum", ok ? "text-ok" : "text-warn")}>
                    {ok ? "충분해요" : `${formatManwon(need - balance)} 더`}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[12px] leading-snug text-ink-3">
            저장된 납입 총액을 잔액으로 보고 계산했어요. 공고일 뒤에 넣은 돈은 그 공고에 인정되지 않아요.
          </p>
        </div>
      )}

      <p className="mt-4 text-[13px] leading-relaxed text-ink-3">
        예치금과 함께 가입 기간(수도권 1년, 그 밖의 지역 6개월, 투기과열지구·청약과열지역 2년)도 채워야 1순위예요. 규제지역은
        세대주 요건 등이 더 붙어요. 청약저축은 국민주택(공공) 전용이라 민영주택에 쓸 수 없어요.
      </p>
    </Card>
  );
}
