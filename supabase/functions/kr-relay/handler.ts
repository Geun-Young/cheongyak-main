/**
 * 한국 정부 사이트 중계기 — Supabase Edge Function(kr-relay)의 본체.
 *
 * 왜 필요한가: 마이홈포털·공공데이터포털은 해외 IP를 403으로 막는다(project.md 8-1).
 * GitHub Actions 러너는 미국에 있어서 직접 부르면 막힌다. 이 함수를 서울 리전(ap-northeast-2)에서
 * 돌리면 한국 IP로 나가므로, 수집 스크립트가 그 요청만 여기를 거친다(src/lib/ingest/kr-fetch.ts).
 * 2026-09-26에 서울 리전 Supabase(AWS 서울)에서 두 사이트 모두 200이 나는 것을 확인했다.
 *
 * 열린 프록시가 되면 안 되므로 두 겹으로 막는다.
 *  1) 중계기 전용 비밀값(x-relay-secret = KR_RELAY_SECRET)을 가진 호출만 받는다.
 *     Supabase 게이트웨이의 JWT 검증은 anon 키로도 통과하는데 anon 키는 브라우저에 공개돼 있어서 부족하다.
 *     service_role 키와 비교하지 않는 이유: 새 API 키를 쓰는 프로젝트는 함수에 들어가는
 *     SUPABASE_SERVICE_ROLE_KEY가 예전 형식(JWT) 키와 달라서 일치하지 않는다(2026-09-26 실제로 겪음).
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

/** 응답마다 붙는, 이 함수가 실제로 돈 리전. 서울(ap-northeast-2)이 아니면 한국 사이트가 막는다 */
export const REGION_HEADER = "x-kr-relay-region";

export function createHandler(relaySecret: string, region = "unknown") {
  return async function handle(req: Request): Promise<Response> {
    if (!relaySecret || req.headers.get("x-relay-secret") !== relaySecret) {
      return fail(401, "중계기 비밀값(KR_RELAY_SECRET)이 맞지 않아요");
    }

    const params = new URL(req.url).searchParams;
    // 진단: 이 함수가 어느 리전에서, 어떤 IP로 나가는지(scripts/check-relay.ts)
    if (params.get("diag") === "1") {
      let ip = "unknown";
      try {
        ip = (await (await fetch("https://api.ipify.org")).text()).trim();
      } catch {
        // 진단용이라 실패해도 리전은 알려 준다
      }
      return Response.json({ region, ip }, { headers: { [RELAY_HEADER]: "diag", [REGION_HEADER]: region } });
    }

    const target = params.get("url");
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

    const out = new Headers({ [RELAY_HEADER]: "upstream", [REGION_HEADER]: region });
    for (const h of FORWARD_RESPONSE_HEADERS) {
      const v = upstream.headers.get(h);
      if (v) out.set(h, v);
    }
    // 본문은 그대로 흘려보낸다 — PDF 같은 바이너리도 손대지 않는다
    return new Response(upstream.body, { status: upstream.status, headers: out });
  };
}
