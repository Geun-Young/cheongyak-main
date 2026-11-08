/**
 * 한국 정부 사이트(공공데이터포털 API·마이홈포털)용 fetch.
 *
 * 이 사이트들은 해외 IP를 막는다(project.md 8-1). 로컬 PC(한국 IP)에서는 그냥 fetch하고,
 * GitHub Actions처럼 해외에서 돌 때는 KR_RELAY=supabase를 켜서 서울 리전의
 * Supabase Edge Function(supabase/functions/kr-relay)을 거쳐 한국 IP로 나간다.
 *
 * 중계기가 배포되지 않았거나 키가 틀리면 원 사이트의 응답처럼 보이면 안 된다 —
 * "PDF 없음"으로 잘못 기록되지 않도록 여기서 분명한 에러로 멈춘다.
 */

const RELAY_REGION = "ap-northeast-2"; // 서울
const RELAY_HEADER = "x-kr-relay"; // supabase/functions/kr-relay/handler.ts와 같은 값

/** 한국 사이트에 닿지 못함(해외 IP 차단, 중계기 미배포·인증 실패). 공고 탓이 아니므로 배치를 멈춘다 */
export class KrAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KrAccessError";
  }
}

export function usingKrRelay(): boolean {
  return process.env.KR_RELAY === "supabase";
}

export async function krFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!usingKrRelay()) return fetch(url, init);

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.KR_RELAY_SECRET;
  if (!base || !key || !secret) {
    throw new KrAccessError(
      "KR_RELAY=supabase에는 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KR_RELAY_SECRET이 필요해요.",
    );
  }

  const relay = new URL("/functions/v1/kr-relay", base);
  relay.searchParams.set("url", url);
  // 지역을 정하지 않으면 호출한 곳(미국 러너)과 가까운 리전에서 돌아 다시 막힌다
  relay.searchParams.set("forceFunctionRegion", RELAY_REGION);
  const headers = new Headers(init.headers);
  // authorization은 Supabase 게이트웨이의 JWT 검증용, x-relay-secret은 중계기 자체의 문지기다
  headers.set("authorization", `Bearer ${key}`);
  headers.set("x-relay-secret", secret);
  headers.set("x-region", RELAY_REGION);

  const res = await fetch(relay, { ...init, headers });
  if (res.headers.get(RELAY_HEADER) !== "upstream") {
    const body = (await res.text()).slice(0, 200);
    throw new KrAccessError(`한국 중계기(kr-relay) 오류 ${res.status}: ${body}`);
  }
  return res;
}

/**
 * 먼저 직접 부르고, 막히면(403·연결 실패) KR_RELAY=supabase일 때만 서울 중계기로 다시 부른다.
 * 해외 IP를 막는지 확인하지 못한 사이트(청년안심주택 누리집·SH 인터넷청약, project.md 34·35번)용 —
 * 막지 않으면 GitHub 러너에서 중계기 없이 바로 되고, 막으면 중계기 허용 목록(kr-relay ALLOWED_HOSTS)에 그 호스트가
 * 배포돼 있어야 한다. 둘 다 안 되면 krFetch가 KrAccessError로 멈춘다(공고 데이터는 건드리지 않음).
 */
export async function directThenRelay(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    const res = await fetch(url, init);
    if (res.status !== 403) return res;
    if (!usingKrRelay()) return res;
  } catch (e) {
    if (!usingKrRelay()) throw e;
  }
  return krFetch(url, init);
}
