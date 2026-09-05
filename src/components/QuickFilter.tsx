"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { REGIONS } from "@/lib/regions";
import { BRACKETS, bracketLabel } from "@/lib/income";
import { profileFromQuery } from "@/lib/profile";
import { saveGuestProfile } from "@/lib/guest";
import { startOfToday } from "@/lib/format";
import { Button, Select, cx } from "./ui";

const thisYear = startOfToday().getFullYear();
const YEARS = Array.from({ length: thisYear - 1950 - 18 }, (_, i) => thisYear - 19 - i);

/**
 * 비회원 빠른 필터. 질문 5개에 답하면 바로 판정된 목록으로 간다.
 * 라벨을 "질문"으로 써서 처음 온 사람도 무엇을 고르는지 바로 안다.
 */
export function QuickFilter({ compact = false, size = "md" }: { compact?: boolean; size?: "md" | "lg" }) {
  const router = useRouter();
  const [region, setRegion] = useState("서울");
  const [birthYear, setBirthYear] = useState("1994");
  const [income, setIncome] = useState("100");
  const [marital, setMarital] = useState("single");
  const [housing, setHousing] = useState("none");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams({ region, birthYear, income, marital, housing });
    saveGuestProfile(profileFromQuery(q));
    router.push(`/announcements?${q.toString()}`);
  };

  const big = size === "lg";
  const selectCls = cx(big && "h-13 text-[17px]");
  const questions: { n: number; q: string; id: string; control: React.ReactNode; hint?: React.ReactNode }[] = [
    {
      n: 1,
      q: "어디에 사세요?",
      id: "qf-region",
      control: (
        <Select id="qf-region" value={region} onChange={(e) => setRegion(e.target.value)} className={selectCls}>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
      ),
    },
    {
      n: 2,
      q: "몇 년생이세요?",
      id: "qf-year",
      control: (
        <Select id="qf-year" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className={selectCls}>
          {YEARS.map((y) => <option key={y} value={y}>{y}년</option>)}
        </Select>
      ),
    },
    {
      n: 3,
      q: "소득은 어느 정도예요?",
      id: "qf-income",
      control: (
        <Select id="qf-income" value={income} onChange={(e) => setIncome(e.target.value)} className={selectCls}>
          {BRACKETS.map((b) => <option key={b} value={b}>{bracketLabel(b)}</option>)}
        </Select>
      ),
      hint: (
        <Link href="/tools/income" className="font-semibold text-brand underline-offset-2 hover:underline">
          잘 모르겠으면 건강보험료로 계산하기
        </Link>
      ),
    },
    {
      n: 4,
      q: "결혼하셨나요?",
      id: "qf-marital",
      control: (
        <Select id="qf-marital" value={marital} onChange={(e) => setMarital(e.target.value)} className={selectCls}>
          <option value="single">아니요 (미혼)</option>
          <option value="married">네 (기혼)</option>
          <option value="engaged">곧 해요 (예비 신혼부부)</option>
        </Select>
      ),
    },
    {
      n: 5,
      q: "집을 갖고 계세요?",
      id: "qf-housing",
      control: (
        <Select id="qf-housing" value={housing} onChange={(e) => setHousing(e.target.value)} className={selectCls}>
          <option value="none">아니요 (무주택)</option>
          <option value="owner">네 (유주택)</option>
        </Select>
      ),
      hint: <span>같이 사는 가족까지 포함해요.</span>,
    },
  ];

  return (
    <form onSubmit={submit} className="grid gap-5" aria-label="빠른 조건 필터">
      <ol className={cx("grid gap-4", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-5")}>
        {questions.map((item) => (
          <li key={item.id} className="flex flex-col gap-2">
            <label htmlFor={item.id} className="flex items-center gap-2 text-[15px] font-bold text-ink">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-extrabold text-white tnum">
                {item.n}
              </span>
              {item.q}
            </label>
            {item.control}
            {item.hint && <div className="text-[13px] leading-snug text-ink-3">{item.hint}</div>}
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-ink-3">고른 내용은 서버에 저장되지 않아요. 이 브라우저 탭에서만 써요.</p>
        <Button type="submit" size="lg" className={cx("w-full sm:w-auto", big && "h-14 px-7 text-[17px]")}>
          내가 신청할 수 있는 공고 보기
          <ArrowRight size={20} strokeWidth={2.4} />
        </Button>
      </div>
    </form>
  );
}
