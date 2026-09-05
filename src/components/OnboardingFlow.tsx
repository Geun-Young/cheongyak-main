"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { IncomeBracket, Profile, Region } from "@/lib/types";
import { REGIONS } from "@/lib/regions";
import { BRACKETS, bracketLabel } from "@/lib/income";
import { EMPTY_PROFILE, useProfile } from "@/lib/profile";
import { formatManwon } from "@/lib/format";
import { FieldHelp } from "./FieldHelp";
import { IncomeCalculator } from "./IncomeCalculator";
import { Button, Card, Chip, Container, Field, Input, SegmentedControl, Select, Toggle, cx } from "./ui";

export const STEPS = [
  { key: "basic", title: "기본 정보", lead: "나이와 거주지는 거의 모든 공고의 기본 조건이에요." },
  { key: "household", title: "세대 구성", lead: "혼인 여부와 가구원 수로 신청 유형과 소득 기준이 정해져요." },
  { key: "housing", title: "주택 소유", lead: "세대원 전원이 무주택이어야 하는 공고가 대부분이에요." },
  { key: "income", title: "소득 구간", lead: "금액은 저장하지 않아요. 계산된 구간만 저장돼요." },
  { key: "assets", title: "자산", lead: "공공임대는 총자산과 자동차가액에 상한이 있어요." },
  { key: "account", title: "청약통장", lead: "가입 기간과 납입 횟수가 순위와 가점을 좌우해요." },
  { key: "done", title: "완료", lead: "" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function OnboardingFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { profile, save } = useProfile();

  const initialStep = Math.max(0, STEPS.findIndex((s) => s.key === params.get("step")));
  const [step, setStep] = useState(initialStep === -1 ? 0 : initialStep);
  const [draft, setDraft] = useState<Profile>(EMPTY_PROFILE);
  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current && profile) {
      setDraft(profile);
      loaded.current = true;
    }
  }, [profile]);

  const patch = (p: Partial<Profile>) => setDraft((d) => ({ ...d, ...p }));
  const current = STEPS[step];
  const isLast = current.key === "done";
  const progress = Math.round((step / (STEPS.length - 1)) * 100);

  const canNext = (() => {
    if (current.key === "basic") return Boolean(draft.birthDate && draft.residenceSince);
    return true;
  })();

  const next = () => {
    save({ ...draft, onboardingDone: profile?.onboardingDone ?? false });
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0 });
  };
  const back = () => setStep((s) => Math.max(0, s - 1));
  const finish = () => {
    save({ ...draft, onboardingDone: true });
    router.push("/dashboard");
  };

  return (
    <Container className="max-w-3xl py-6 md:py-10">
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-ink-2">
            {isLast ? "입력 완료" : <><span className="tnum">{step + 1}</span> / {STEPS.length - 1}단계</>}
          </span>
          <Link href="/dashboard" className="font-semibold text-ink-3 hover:text-brand">
            나중에 할게요
          </Link>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <ol className="mt-3 hidden gap-1 md:flex">
          {STEPS.slice(0, -1).map((s, i) => (
            <li key={s.key} className={cx("flex-1 text-[12px] font-semibold", i === step ? "text-brand" : i < step ? "text-ink-2" : "text-ink-3")}>
              {s.title}
            </li>
          ))}
        </ol>
      </div>

      <Card>
        <h1 className="text-[22px] font-bold text-ink md:text-2xl">{isLast ? `${draft.name || "회원"}님, 다 됐어요` : current.title}</h1>
        {current.lead && <p className="mt-1 text-ink-3">{current.lead}</p>}

        <div className="mt-6 space-y-6">
          {current.key === "basic" && <BasicStep d={draft} patch={patch} />}
          {current.key === "household" && <HouseholdStep d={draft} patch={patch} />}
          {current.key === "housing" && <HousingStep d={draft} patch={patch} />}
          {current.key === "income" && <IncomeStep d={draft} patch={patch} />}
          {current.key === "assets" && <AssetsStep d={draft} patch={patch} />}
          {current.key === "account" && <AccountStep d={draft} patch={patch} />}
          {current.key === "done" && <DoneStep d={draft} patch={patch} goTo={(k) => setStep(STEPS.findIndex((s) => s.key === k))} />}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
          <Button variant="ghost" onClick={back} disabled={step === 0}>
            <ArrowLeft size={16} /> 이전
          </Button>
          {isLast ? (
            <Button size="lg" onClick={finish}>
              <Check size={18} strokeWidth={2.6} /> 판정 보러 가기
            </Button>
          ) : (
            <Button size="lg" onClick={next} disabled={!canNext}>
              {step === STEPS.length - 2 ? "입력 마치기" : "다음"} <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </Card>
    </Container>
  );
}

type StepProps = { d: Profile; patch: (p: Partial<Profile>) => void };

function BasicStep({ d, patch }: StepProps) {
  return (
    <>
      <Field label="어떻게 불러드릴까요?" htmlFor="ob-name">
        <Input id="ob-name" value={d.name} onChange={(e) => patch({ name: e.target.value })} placeholder="예: 김청약" />
      </Field>
      <Field label="생년월일" htmlFor="ob-birth" hint="청년(만 19~39세)·고령자 같은 나이 조건에 써요.">
        <Input id="ob-birth" type="date" value={d.birthDate} onChange={(e) => patch({ birthDate: e.target.value })} max="2010-12-31" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="현재 거주 지역(시·도)" htmlFor="ob-region">
          <Select id="ob-region" value={d.residenceRegion} onChange={(e) => patch({ residenceRegion: e.target.value as Region })}>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="이 지역에 살기 시작한 날" htmlFor="ob-since">
          <Input id="ob-since" type="date" value={d.residenceSince} onChange={(e) => patch({ residenceSince: e.target.value })} />
        </Field>
      </div>
      <FieldHelp
        steps={[
          "정부24에서 「주민등록표 등본」을 발급(무료)해요.",
          "「전입일」 항목이 이 지역에 살기 시작한 날이에요. 같은 시·도 안에서 이사했다면 시·도 전입일 기준이에요.",
        ]}
        links={[{ label: "정부24 등본 발급", href: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000015" }]}
        note="많은 공고가 「해당 지역 1년 이상 거주」를 1순위 조건으로 둬요."
      />
      <Field label="살고 싶은 지역 (여러 개 가능)">
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => {
            const on = d.desiredRegions.includes(r);
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => patch({ desiredRegions: on ? d.desiredRegions.filter((x) => x !== r) : [...d.desiredRegions, r] })}
                className={cx("h-9 rounded-md border px-3 text-sm font-semibold", on ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink-2 hover:border-brand hover:text-brand")}
              >
                {r}
              </button>
            );
          })}
        </div>
      </Field>
    </>
  );
}

function HouseholdStep({ d, patch }: StepProps) {
  return (
    <>
      <Field label="혼인 상태" hint="예비 신혼부부는 입주 전까지 혼인신고를 하면 신혼부부 유형으로 신청할 수 있어요.">
        <SegmentedControl
          name="혼인 상태"
          value={d.maritalStatus}
          onChange={(v) => patch({ maritalStatus: v, marriageDate: v === "married" ? d.marriageDate : undefined })}
          options={[
            { value: "single", label: "미혼" },
            { value: "married", label: "기혼" },
            { value: "engaged", label: "예비 신혼부부" },
          ]}
        />
      </Field>
      {d.maritalStatus === "married" && (
        <Field label="혼인신고일" htmlFor="ob-marriage" hint="신혼부부 유형은 대부분 혼인 7년 이내예요.">
          <Input id="ob-marriage" type="date" value={d.marriageDate ?? ""} onChange={(e) => patch({ marriageDate: e.target.value })} />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="가구원 수 (본인 포함)" htmlFor="ob-household">
          <Select id="ob-household" value={d.householdSize} onChange={(e) => patch({ householdSize: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}명</option>)}
          </Select>
        </Field>
        <Field label="미성년 자녀 수" htmlFor="ob-children">
          <Select id="ob-children" value={d.numChildren} onChange={(e) => patch({ numChildren: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}명</option>)}
          </Select>
        </Field>
      </div>
      <FieldHelp
        question="가구원 수는 어떻게 세나요?"
        steps={[
          "주민등록표 등본에 함께 올라 있는 세대원을 기준으로 세요. 본인 포함이에요.",
          "배우자는 주소가 달라도 포함돼요. 태아 포함 여부는 공고마다 달라요.",
          "가구원 수가 늘면 소득 기준 금액도 올라가요. 그래서 소득 구간보다 먼저 물어봐요.",
        ]}
      />
    </>
  );
}

function HousingStep({ d, patch }: StepProps) {
  return (
    <>
      <Field label="주택 소유 여부" hint="세대원 전원 기준이에요. 부모님과 같은 등본에 있고 부모님이 집이 있으면 유주택이에요.">
        <SegmentedControl
          name="주택 소유 여부"
          value={d.housingStatus}
          onChange={(v) => patch({ housingStatus: v, noHousingSince: v === "owner" ? undefined : d.noHousingSince })}
          options={[
            { value: "none", label: "무주택" },
            { value: "owner", label: "유주택" },
          ]}
        />
      </Field>
      {d.housingStatus === "none" && (
        <Field label="무주택 기간 시작일" htmlFor="ob-nohouse" hint="집을 가져본 적이 없으면 만 30세가 된 날(혼인했다면 혼인신고일)부터 세요.">
          <Input id="ob-nohouse" type="date" value={d.noHousingSince ?? ""} onChange={(e) => patch({ noHousingSince: e.target.value })} />
        </Field>
      )}
      <FieldHelp
        steps={[
          "청약홈 > 청약자격확인 > 「주택소유확인」에서 세대원 전원의 소유 여부를 볼 수 있어요.",
          "정부24에서 「지방세 세목별 과세증명서」를 떼면 재산세(주택) 부과 내역으로도 확인돼요.",
        ]}
        links={[
          { label: "청약홈 주택소유확인", href: "https://www.applyhome.co.kr" },
          { label: "정부24", href: "https://www.gov.kr" },
        ]}
      />
    </>
  );
}

function IncomeStep({ d, patch }: StepProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-2 px-3 py-2.5 text-sm">
        <span className="text-ink-3">현재 저장된 구간</span>
        <strong className="text-ink">{bracketLabel(d.incomeBracket)}</strong>
        <Chip size="sm" tone={d.incomeConfidence === "certain" ? "ok" : d.incomeConfidence === "estimate" ? "warn" : "muted"}>
          {d.incomeConfidence === "certain" ? "확실" : d.incomeConfidence === "estimate" ? "추정" : "미입력"}
        </Chip>
      </div>

      <IncomeCalculator
        householdSize={d.householdSize}
        onApply={(e, household) => patch({ incomeBracket: e.bracket, incomeConfidence: e.confidence, householdSize: household })}
      />

      <details className="rounded-md border border-line">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink-2">이미 구간을 알고 있어요</summary>
        <div className="px-4 pb-4">
          <Select value={d.incomeBracket} onChange={(e) => patch({ incomeBracket: Number(e.target.value) as IncomeBracket, incomeConfidence: "estimate" })}>
            {BRACKETS.map((b) => <option key={b} value={b}>{bracketLabel(b)}</option>)}
          </Select>
        </div>
      </details>

      <FieldHelp
        question="건강보험료는 어디서 보나요?"
        steps={[
          "The건강보험 앱 또는 국민건강보험공단 홈페이지 > 민원여기요 > 「보험료 조회/납부」에서 최근 월 보험료를 확인해요.",
          "직장인은 급여명세서의 「건강보험」 항목 금액이에요. 장기요양보험료는 빼요.",
          "세대원이 여럿이면 각자의 보험료를 더해서 넣어요. 피부양자는 0원이에요.",
        ]}
        links={[
          { label: "건강보험공단 보험료 조회", href: "https://www.nhis.or.kr" },
          { label: "마이홈포털 자가진단", href: "https://www.myhome.go.kr" },
        ]}
        note="기관 심사는 건강보험 보수월액과 국세청 소득을 세대원 합산으로 봐요. 자영업·프리랜서는 전년도 종합소득 기준이라 차이가 날 수 있어요."
      />
    </>
  );
}

function AssetsStep({ d, patch }: StepProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="세대 총자산" htmlFor="ob-assets" hint={d.totalAssets > 0 ? formatManwon(d.totalAssets) : "만원 단위로 넣어요. 예: 8500 = 8,500만 원"}>
          <div className="relative">
            <Input id="ob-assets" inputMode="numeric" value={d.totalAssets || ""} onChange={(e) => patch({ totalAssets: Number(e.target.value.replace(/[^\d]/g, "")) })} className="pr-12 tnum" placeholder="0" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">만원</span>
          </div>
        </Field>
        <Field label="자동차가액" htmlFor="ob-car" hint={d.carValue > 0 ? formatManwon(d.carValue) : "차가 없으면 0이에요."}>
          <div className="relative">
            <Input id="ob-car" inputMode="numeric" value={d.carValue || ""} onChange={(e) => patch({ carValue: Number(e.target.value.replace(/[^\d]/g, "")) })} className="pr-12 tnum" placeholder="0" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">만원</span>
          </div>
        </Field>
      </div>
      <FieldHelp
        question="총자산은 어떻게 계산하나요?"
        steps={[
          "부동산(공시가격) + 자동차 + 금융자산 + 일반자산 − 부채예요. 전세보증금은 일반자산에 들어가요.",
          "자동차가액은 보험개발원 「차량기준가액」이에요. 보험사 앱의 차량가액과 거의 같아요.",
          "2025년 기준 국민임대·행복주택 상한은 총자산 3억 3,700만 원, 자동차 3,803만 원이에요. 청년 계층은 더 낮아요.",
        ]}
        links={[
          { label: "보험개발원 차량기준가액", href: "https://www.kidi.or.kr" },
          { label: "마이홈포털 자산기준 안내", href: "https://www.myhome.go.kr" },
        ]}
      />
    </>
  );
}

function AccountStep({ d, patch }: StepProps) {
  return (
    <>
      <Toggle
        label="청약통장이 있어요"
        description="주택청약종합저축, 청약저축, 청약예금·부금 모두 포함이에요."
        checked={d.hasSubscription}
        onChange={(v) => patch({ hasSubscription: v })}
      />
      {d.hasSubscription && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="통장 종류" htmlFor="ob-acct-type">
              <Select id="ob-acct-type" value={d.subscriptionType ?? "주택청약종합저축"} onChange={(e) => patch({ subscriptionType: e.target.value as Profile["subscriptionType"] })}>
                {["주택청약종합저축", "청약저축", "청약예금", "청약부금"].map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="가입일" htmlFor="ob-acct-start">
              <Input id="ob-acct-start" type="date" value={d.subscriptionStart ?? ""} onChange={(e) => patch({ subscriptionStart: e.target.value })} />
            </Field>
            <Field label="납입 인정 횟수" htmlFor="ob-acct-count" hint="연체 없이 매달 낸 횟수예요. 선납·미납분은 은행이 인정한 횟수를 넣어요.">
              <div className="relative">
                <Input id="ob-acct-count" inputMode="numeric" value={d.paymentCount || ""} onChange={(e) => patch({ paymentCount: Number(e.target.value.replace(/[^\d]/g, "")) })} className="pr-10 tnum" placeholder="0" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">회</span>
              </div>
            </Field>
            <Field label="납입 인정 총액" htmlFor="ob-acct-total" hint="공공분양 일반공급은 월 25만 원까지만 인정돼요.">
              <div className="relative">
                <Input id="ob-acct-total" inputMode="numeric" value={d.totalDeposit || ""} onChange={(e) => patch({ totalDeposit: Number(e.target.value.replace(/[^\d]/g, "")) })} className="pr-12 tnum" placeholder="0" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">만원</span>
              </div>
            </Field>
          </div>
        </>
      )}
      <FieldHelp
        steps={[
          "청약홈 > 청약자격확인 > 「청약통장 가입내역」에서 가입일·납입 인정 횟수·인정 금액을 한 번에 볼 수 있어요.",
          "가입 은행 앱에서도 「청약 순위확인서」를 발급하면 같은 정보가 나와요.",
        ]}
        links={[{ label: "청약홈 청약통장 조회", href: "https://www.applyhome.co.kr" }]}
        note="국민임대 전용 50㎡ 미만, 매입임대, 전세임대는 통장이 없어도 신청할 수 있어요. 없어도 걱정 마세요."
      />
    </>
  );
}

function DoneStep({ d, patch, goTo }: StepProps & { goTo: (k: StepKey) => void }) {
  const rows: { k: StepKey; label: string; value: string }[] = [
    { k: "basic", label: "거주", value: `${d.residenceRegion} · ${d.birthDate || "생년월일 미입력"}` },
    { k: "household", label: "세대", value: `${d.maritalStatus === "single" ? "미혼" : d.maritalStatus === "married" ? "기혼" : "예비 신혼부부"} · ${d.householdSize}인 가구 · 자녀 ${d.numChildren}명` },
    { k: "housing", label: "주택", value: d.housingStatus === "none" ? `무주택${d.noHousingSince ? ` (${d.noHousingSince}부터)` : ""}` : "유주택" },
    { k: "income", label: "소득", value: bracketLabel(d.incomeBracket) },
    { k: "assets", label: "자산", value: `총자산 ${formatManwon(d.totalAssets)} · 자동차 ${formatManwon(d.carValue)}` },
    { k: "account", label: "청약통장", value: d.hasSubscription ? `${d.subscriptionType ?? "주택청약종합저축"} · ${d.paymentCount}회 · ${formatManwon(d.totalDeposit)}` : "없음" },
  ];
  return (
    <>
      <p className="text-ink-2">입력한 내용이에요. 틀린 게 있으면 항목을 눌러 고칠 수 있어요. 마이페이지에서도 언제든 바꿔요.</p>
      <ul className="divide-y divide-line rounded-md border border-line">
        {rows.map((r) => (
          <li key={r.k}>
            <button type="button" onClick={() => goTo(r.k)} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-surface-2">
              <span className="w-20 shrink-0 text-sm font-semibold text-ink-3">{r.label}</span>
              <span className="flex-1 text-[15px] text-ink">{r.value}</span>
              <span className="text-sm font-semibold text-brand">수정</span>
            </button>
          </li>
        ))}
      </ul>
      <div>
        <p className="text-sm font-semibold text-ink-2">알림</p>
        <div className="divide-y divide-line">
          <Toggle label="마감 3일 전·1일 전 알림" description="신청 가능한 공고만 보내요." checked={d.notifications.deadline} onChange={(v) => patch({ notifications: { ...d.notifications, deadline: v } })} />
          <Toggle label="새 공고 즉시 알림" description="내 조건에 맞는 공고가 올라오면 바로 알려드려요." checked={d.notifications.newMatch} onChange={(v) => patch({ notifications: { ...d.notifications, newMatch: v } })} />
        </div>
      </div>
    </>
  );
}
