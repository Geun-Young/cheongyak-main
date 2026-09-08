"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUpWithEmail } from "@/lib/auth";
import { SocialLoginButtons } from "@/components/SocialLoginButtons";
import { Button, Card, Container, Field, Input, cx } from "@/components/ui";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState<Record<string, boolean>>({ terms: false, privacy: false, marketing: false });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentEmail, setSentEmail] = useState(false);

  const requiredOk = AGREEMENTS.filter((a) => a.required).every((a) => agreed[a.key]);
  const allChecked = AGREEMENTS.every((a) => agreed[a.key]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requiredOk) return;
    setError(null);
    setLoading(true);
    const { error: err, needsEmailConfirmation } = await signUpWithEmail(email, password);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (needsEmailConfirmation) {
      setSentEmail(true);
      return;
    }
    // 이메일 확인이 꺼져 있으면 가입과 동시에 로그인된다 — 바로 정보 입력으로 보낸다.
    router.push("/onboarding");
    router.refresh();
  };

  if (sentEmail) {
    return (
      <Container className="flex min-h-[70vh] items-center justify-center py-10">
        <Card className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-ink">거의 다 됐어요</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
            <strong className="text-ink">{email}</strong> 으로 확인 메일을 보냈어요.
            메일의 링크를 누르면 가입이 끝나요.
          </p>
          <p className="mt-3 text-[13px] text-ink-3">
            메일이 안 보이면 스팸함도 확인해 주세요. 링크를 누르면 자동으로 로그인돼요.
          </p>
          <Button variant="secondary" size="lg" className="mt-5 w-full" onClick={() => router.push("/login")}>
            로그인 화면으로
          </Button>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-10">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-ink">조건을 저장해 두면 매번 안 물어봐요</h1>
        <p className="mt-1 text-ink-3">가입 후 6단계 정보 입력이 있어요. 5분이면 끝나요.</p>

        <div className="mt-5 space-y-3">
          <fieldset className="rounded-md border border-line">
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
        </div>

        {!requiredOk && (
          <p className="mt-3 text-[13px] text-ink-3">필수 항목에 동의하면 가입할 수 있어요.</p>
        )}

        <div className={cx("mt-4", !requiredOk && "pointer-events-none opacity-50")} aria-disabled={!requiredOk}>
          <SocialLoginButtons label="signup" />

          <div className="my-5 flex items-center gap-3 text-[13px] text-ink-3">
            <span className="h-px flex-1 bg-line" />
            또는 이메일로
            <span className="h-px flex-1 bg-line" />
          </div>

          <form className="space-y-3" onSubmit={submit}>
            <Field label="이메일" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </Field>
            <Field label="비밀번호" htmlFor="password" hint="6자 이상으로 만들어 주세요.">
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </Field>

            {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={!requiredOk || loading}>
              {loading ? "가입 중이에요..." : "이메일로 가입하기"}
            </Button>
          </form>
        </div>

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
