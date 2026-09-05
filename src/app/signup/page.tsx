"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EMPTY_PROFILE, useProfile } from "@/lib/profile";
import { Button, Card, Container, Field, Input, cx } from "@/components/ui";
import { KakaoIcon } from "@/components/KakaoIcon";

const AGREEMENTS = [
  { key: "terms", required: true, label: "이용약관 동의", href: "/terms" },
  {
    key: "privacy",
    required: true,
    label: "개인정보 수집·이용 동의",
    href: "/privacy",
    note: "수집 항목: 생년월일, 거주 지역, 세대 구성, 무주택 여부, 소득 구간(금액 아님), 자산 구간, 청약통장 정보. 판정과 알림에만 써요.",
  },
  { key: "marketing", required: false, label: "새 공고·혜택 소식 받기", href: undefined },
];

export default function SignupPage() {
  const router = useRouter();
  const { save } = useProfile();
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState<Record<string, boolean>>({ terms: false, privacy: false, marketing: false });

  const requiredOk = AGREEMENTS.filter((a) => a.required).every((a) => agreed[a.key]);
  const allChecked = AGREEMENTS.every((a) => agreed[a.key]);

  const start = () => {
    if (!requiredOk) return;
    save({ ...EMPTY_PROFILE, name: name.trim() || "회원", notifications: { ...EMPTY_PROFILE.notifications } });
    router.push("/onboarding");
  };

  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-10">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-ink">조건을 저장해 두면 매번 안 물어봐요</h1>
        <p className="mt-1 text-ink-3">가입 후 6단계 정보 입력이 있어요. 5분이면 끝나요.</p>

        <Field label="어떻게 불러드릴까요?" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김청약" className="mt-0" />
        </Field>

        <fieldset className="mt-5 rounded-md border border-line">
          <label className="flex cursor-pointer items-center gap-3 border-b border-line px-4 py-3 font-semibold">
            <input
              type="checkbox"
              className="size-4 accent-brand"
              checked={allChecked}
              onChange={(e) => {
                const v = e.target.checked;
                setAgreed({ terms: v, privacy: v, marketing: v });
              }}
            />
            전체 동의
          </label>
          {AGREEMENTS.map((a) => (
            <div key={a.key} className="px-4 py-2.5">
              <label className="flex cursor-pointer items-center gap-3 text-[15px]">
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={agreed[a.key]}
                  onChange={(e) => setAgreed({ ...agreed, [a.key]: e.target.checked })}
                />
                <span className={cx("text-xs font-bold", a.required ? "text-brand" : "text-ink-3")}>
                  {a.required ? "필수" : "선택"}
                </span>
                <span className="flex-1">{a.label}</span>
                {a.href && (
                  <Link href={a.href} className="text-[13px] font-semibold text-ink-3 underline underline-offset-2">
                    보기
                  </Link>
                )}
              </label>
              {a.note && <p className="mt-1 pl-7 text-[12px] leading-snug text-ink-3">{a.note}</p>}
            </div>
          ))}
        </fieldset>

        <Button variant="kakao" size="lg" className="mt-5 w-full" onClick={start} disabled={!requiredOk}>
          <KakaoIcon />
          카카오로 시작하기
        </Button>
        <Button variant="secondary" size="lg" className="mt-2 w-full" onClick={start} disabled={!requiredOk}>
          이메일로 시작하기
        </Button>

        <p className="mt-5 text-center text-sm text-ink-2">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="font-semibold text-brand">
            로그인
          </Link>
        </p>
      </Card>
    </Container>
  );
}
