"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";

/**
 * 로그인 세션 훅. 브라우저에서만 쓴다.
 *
 * loading 상태를 따로 두는 이유: 첫 렌더에는 세션을 아직 모른다. 이걸 구분하지 않으면
 * 로그인한 사용자에게도 잠깐 "로그인하세요" 화면이 번쩍 보인다.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  }, []);

  return { user, loading, isLoggedIn: user !== null, signOut };
}

export interface AuthError {
  message: string;
}

/** Supabase가 주는 영문 에러 메시지를 사용자에게 보여줄 한국어로 바꾼다 */
function toKoreanMessage(raw: string): string {
  if (raw.includes("Invalid login credentials")) return "이메일 또는 비밀번호가 맞지 않아요.";
  if (raw.includes("User already registered")) return "이미 가입된 이메일이에요. 로그인해 주세요.";
  if (raw.includes("Password should be at least")) return "비밀번호는 6자 이상이어야 해요.";
  if (raw.includes("Unable to validate email address")) return "이메일 형식을 확인해 주세요.";
  if (raw.includes("Email not confirmed")) return "이메일 인증이 아직 안 됐어요. 받은 편지함을 확인해 주세요.";
  if (raw.includes("provider is not enabled") || raw.includes("Unsupported provider")) {
    return "이 로그인 방식은 아직 준비 중이에요. 다른 방법으로 로그인해 주세요.";
  }
  return raw;
}

export interface SignUpResult {
  error: AuthError | null;
  /**
   * 가입 즉시 세션이 생겼는지. Supabase의 "Confirm email" 설정이 꺼져 있으면 true라
   * 바로 온보딩으로 보낼 수 있고, 켜져 있으면 false라 메일 확인을 안내해야 한다.
   */
  needsEmailConfirmation: boolean;
}

export async function signUpWithEmail(email: string, password: string): Promise<SignUpResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) {
    return { error: { message: toKoreanMessage(error.message) }, needsEmailConfirmation: false };
  }
  return { error: null, needsEmailConfirmation: data.session === null };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthError | null> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { message: toKoreanMessage(error.message) } : null;
}

export type OAuthProvider = "google" | "kakao";

/**
 * 소셜 로그인. Supabase 대시보드(Authentication > Providers)에서 해당 provider를
 * 켜두어야 동작한다. 꺼져 있으면 Supabase가 에러를 돌려주므로 사용자에게 안내한다.
 */
export async function signInWithOAuth(
  provider: OAuthProvider,
  next?: string,
): Promise<AuthError | null> {
  const supabase = createClient();
  const callback = new URL("/auth/callback", window.location.origin);
  if (next) callback.searchParams.set("next", next);

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callback.toString() },
  });
  return error ? { message: toKoreanMessage(error.message) } : null;
}
