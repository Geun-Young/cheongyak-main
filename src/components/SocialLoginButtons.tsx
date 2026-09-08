"use client";

import { useState } from "react";
import { signInWithOAuth, type OAuthProvider } from "@/lib/auth";
import { Button } from "./ui";
import { GoogleIcon } from "./GoogleIcon";
import { KakaoIcon } from "./KakaoIcon";

/**
 * 구글·카카오 로그인 버튼. 로그인·가입 화면이 같은 걸 쓴다.
 * OAuth는 가입/로그인이 한 흐름이라(계정이 없으면 자동 생성) 두 화면에서 문구만 다르다.
 */
export function SocialLoginButtons({ next, label }: { next?: string; label: "login" | "signup" }) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (provider: OAuthProvider) => {
    setError(null);
    setPending(provider);
    const err = await signInWithOAuth(provider, next);
    if (err) {
      // 성공하면 브라우저가 provider로 이동하므로 여기 이후 코드는 실행되지 않는다.
      setError(err.message);
      setPending(null);
    }
  };

  const suffix = label === "login" ? "로 로그인" : "로 시작하기";

  return (
    <div className="space-y-2">
      <Button
        variant="kakao"
        size="lg"
        className="w-full"
        disabled={pending !== null}
        onClick={() => start("kakao")}
      >
        <KakaoIcon />
        {pending === "kakao" ? "카카오로 이동 중..." : `카카오${suffix}`}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        disabled={pending !== null}
        onClick={() => start("google")}
      >
        <GoogleIcon />
        {pending === "google" ? "구글로 이동 중..." : `구글${suffix}`}
      </Button>
      {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
