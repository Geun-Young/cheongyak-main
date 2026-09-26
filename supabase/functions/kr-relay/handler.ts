/**
 * 한국 정부 사이트 중계기 — Supabase Edge Function(kr-relay)의 본체.
 *
 * 왜 필요한가: 마이홈포털·공공데이터포털은 해외 IP를 403으로 막는다(project.md 8-1).
 * GitHub Actions 러너는 미국에 있어서 직접 부르면 막힌다. 이 함수를 서울 리전(ap-northeast-2)에서
 * 돌리면 한국 IP로 나가므로, 수집 스크립트가 그 요청만 여기를 거친다(src/lib/ingest/kr-fetch.ts).
 * 2026-09-26에 서울 리전 Supabase(AWS 서울)에서 두 사이트 모두 200이 나는 것을 확인했다.
 *
 * 열린 프록시가 되면 안 되므로 두 겹으로 막는다.
 *  1) service_role 키를 가진 호출만 받는다(anon 키는 브라우저에 공개돼 있어서 JWT 검증만으로는 부족하다).
 *  2) 허용한 두 호스트로만 보낸다.
 *
 * Deno 전용 코드(Deno.serve)는 index.ts에만 두고, 여기는 표준 Request/Response만 써서
 * Node에서도 그대로 테스트할 수 있게 했다.
 */

const ALLOWED_HOSTS = new Set(["apis.data.go.kr", "www.myhome.go.kr"]);
const FORWARD_REQUEST_HEADERS = ["content-type", "user-agent", "accept"];
const FORWARD_RESPONSE_HEADERS = ["content-type", "content-disposition"];

/** 원 사이트의 응답이면 "upstream", 중계기 자체의 거절·오류면 "error". 호출하는 쪽이 둘을 구분한다 */
export const RELAY_HEADER = "x-kr-relay";

function fail(status: number, message: string): Response {
  return new Response(`kr-relay: ${message}`, {
    status,
    headers: { [RELAY_HEADER]: "error", "content-type": "text/plain; charset=utf-8" },
  });
}

export function createHandler(serviceRoleKey: string) {
  return async function handle(req: Request): Promise<Response> {
    if (!serviceRoleKey || req.headers.get("authorization") !== `Bearer ${serviceRoleKey}`) {
      return fail(401, "service_role 키가 필요해요");
    }

    const target = new URL(req.url).searchParams.get("url");
    let url: URL;
    try {
      url = new URL(target ?? "");
    } catch {
      return fail(400, "url 파라미터가 올바르지 않아요");
    }
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
      return fail(400, `허용하지 않은 주소예요: ${url.hostname}`);
    }

    const headers = new Headers();
    for (const h of FORWARD_REQUEST_HEADERS) {
      const v = req.headers.get(h);
      if (v) headers.set(h, v);
    }

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
      });
    } catch (e) {
      return fail(502, `원 사이트에 연결하지 못했어요: ${e instanceof Error ? e.message : String(e)}`);
    }

    const out = new Headers({ [RELAY_HEADER]: "upstream" });
    for (const h of FORWARD_RESPONSE_HEADERS) {
      const v = upstream.headers.get(h);
      if (v) out.set(h, v);
    }
    // 본문은 그대로 흘려보낸다 — PDF 같은 바이너리도 손대지 않는다
    return new Response(upstream.body, { status: upstream.status, headers: out });
  };
}
