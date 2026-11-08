"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 구글 로그인 — Google Identity Services(GIS) 버튼으로 신원 토큰(ID token)을 받아 Supabase에 바로 넘긴다(project.md 40번).
 *
 * 왜: 예전 방식(supabase.auth.signInWithOAuth)은 구글 → Supabase 주소로 돌아오는 흐름이라 구글 화면에
 * "xzdmkehdljmomczjizjo.supabase.co(으)로 이동"이 떴다. 이걸 없애려면 Supabase 커스텀 도메인(유료)이 필요하다.
 * GIS는 우리 사이트 안에서 팝업으로 열려서 구글 화면에 cheongyak.omaru.kr이 나온다. 무료.
 *
 * 조건: 구글 클라우드 콘솔의 OAuth 클라이언트 "승인된 자바스크립트 원본"에 이 사이트 주소가 있어야 한다.
 * 없거나 스크립트를 못 불러오면(광고 차단 등) onUnavailable로 알려서 예전 버튼을 대신 보여 준다.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GIS_SRC = "https://accounts.google.com/gsi/client";

type CredentialResponse = { credential?: string };
type GoogleId = {
  initialize: (opts: {
    client_id: string;
    callback: (r: CredentialResponse) => void;
    nonce?: string;
    ux_mode?: "popup" | "redirect";
    use_fedcm_for_button?: boolean;
  }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let gisPromise: Promise<GoogleId> | null = null;
function loadGis(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  gisPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("GIS 없음")));
    s.onerror = () => {
      gisPromise = null;
      reject(new Error("GIS 스크립트를 불러오지 못함"));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

/** 원문 nonce는 Supabase에, SHA-256 해시는 구글에 준다(구글이 토큰에 해시를 넣고 Supabase가 원문으로 확인) */
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

export function GoogleSignInButton({
  next,
  label,
  onUnavailable,
}: {
  next?: string;
  label: "login" | "signup";
  onUnavailable: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) {
      onUnavailable();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [gis, nonce] = await Promise.all([loadGis(), makeNonce()]);
        if (cancelled || !ref.current) return;
        gis.initialize({
          client_id: CLIENT_ID,
          nonce: nonce.hashed,
          ux_mode: "popup",
          use_fedcm_for_button: true,
          callback: async ({ credential }) => {
            if (!credential) return;
            setBusy(true);
            setError(null);
            const { error } = await createClient().auth.signInWithIdToken({
              provider: "google",
              token: credential,
              nonce: nonce.raw,
            });
            if (error) {
              setBusy(false);
              setError("구글 로그인을 마치지 못했어요. 다시 시도해 주세요.");
              return;
            }
            // 세션 쿠키가 생겼으니 서버가 갈 곳(정보 입력/대시보드/원래 가려던 곳)을 정한다
            const url = new URL("/auth/continue", window.location.origin);
            if (next) url.searchParams.set("next", next);
            window.location.assign(url);
          },
        });
        const width = Math.min(400, Math.max(200, Math.round(ref.current.getBoundingClientRect().width)));
        gis.renderButton(ref.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: label === "login" ? "signin_with" : "signup_with",
          logo_alignment: "center",
          locale: "ko",
          width,
        });
      } catch {
        if (!cancelled) onUnavailable();
      }
    })();
    return () => {
      cancelled = true;
    };
    // onUnavailable은 부모가 매번 새로 만들어도 다시 그릴 필요가 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, label]);

  return (
    <div>
      {/* 구글이 이 안에 버튼(iframe)을 그린다. 그리기 전에도 자리를 잡아 두어 화면이 출렁이지 않게 */}
      <div ref={ref} className="flex min-h-11 w-full justify-center" aria-busy={busy} />
      {busy && <p className="mt-2 text-center text-sm text-ink-2">로그인하는 중이에요...</p>}
      {error && <p className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
