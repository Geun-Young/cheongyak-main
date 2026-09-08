"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmail } from "@/lib/auth";
import { SocialLoginButtons } from "@/components/SocialLoginButtons";
import { Button, Card, Container, Field, Input } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error"));
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = await signInWithEmail(email, password);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    // proxy가 로그인 게이트에서 붙여준 원래 목적지로 돌아간다.
    router.push(params.get("next") ?? "/dashboard");
    router.refresh();
  };

  return (
    <Card className="w-full max-w-md">
      <h1 className="text-2xl font-bold text-ink">다시 만나서 반가워요</h1>
      <p className="mt-1 text-ink-3">로그인하면 저장된 조건으로 바로 판정을 보여드려요.</p>

      <div className="mt-6">
        <SocialLoginButtons next={params.get("next") ?? undefined} label="login" />
      </div>

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
        <Field label="비밀번호" htmlFor="password">
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6자 이상"
            autoComplete="current-password"
            required
          />
        </Field>

        {error && (
          <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "로그인 중이에요..." : "로그인"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-2">
        처음이신가요?{" "}
        <Link href="/signup" className="font-semibold text-brand">
          가입하고 조건 저장하기
        </Link>
      </p>
      <p className="mt-4 rounded-md bg-surface-2 px-3 py-2 text-[12px] text-ink-3">
        가입 없이 둘러보고 싶으면 <Link href="/#quick" className="font-semibold text-brand">빠른 판정</Link>을 써보세요.
        조건만 입력하면 바로 결과를 보여드려요.
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-10">
      <Suspense fallback={<Card className="w-full max-w-md"><p className="text-ink-3">불러오는 중이에요.</p></Card>}>
        <LoginForm />
      </Suspense>
    </Container>
  );
}
