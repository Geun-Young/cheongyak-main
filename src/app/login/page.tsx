"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEMO_PROFILE, useProfile } from "@/lib/profile";
import { Button, Card, Container, Field, Input } from "@/components/ui";
import { KakaoIcon } from "@/components/KakaoIcon";

export default function LoginPage() {
  const router = useRouter();
  const { save } = useProfile();

  const enterDemo = () => {
    save(DEMO_PROFILE);
    router.push("/dashboard");
  };

  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-10">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-ink">다시 만나서 반가워요</h1>
        <p className="mt-1 text-ink-3">로그인하면 저장된 조건으로 바로 판정을 보여드려요.</p>

        <Button variant="kakao" size="lg" className="mt-6 w-full" onClick={enterDemo}>
          <KakaoIcon />
          카카오로 로그인
        </Button>

        <div className="my-5 flex items-center gap-3 text-[13px] text-ink-3">
          <span className="h-px flex-1 bg-line" />
          또는 이메일로
          <span className="h-px flex-1 bg-line" />
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            enterDemo();
          }}
        >
          <Field label="이메일" htmlFor="email">
            <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" />
          </Field>
          <Field label="비밀번호" htmlFor="password">
            <Input id="password" type="password" placeholder="8자 이상" autoComplete="current-password" />
          </Field>
          <Button type="submit" size="lg" className="w-full">
            로그인
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-2">
          처음이신가요?{" "}
          <Link href="/signup" className="font-semibold text-brand">
            가입하고 조건 저장하기
          </Link>
        </p>
        <p className="mt-4 rounded-md bg-surface-2 px-3 py-2 text-[12px] text-ink-3">
          지금은 껍데기 단계라 어떤 버튼을 눌러도 체험 계정 「김청약」으로 들어가요. 연동 시 Supabase Auth + 카카오 OAuth로 교체돼요.
        </p>
      </Card>
    </Container>
  );
}
