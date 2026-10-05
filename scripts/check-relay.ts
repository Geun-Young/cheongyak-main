/**
 * 한국 중계기(kr-relay) 진단 — 중계기가 어느 리전·IP로 나가는지, 두 한국 사이트가 통과되는지 본다.
 * GitHub Actions에서 공고 갱신 전에 한 번 돌아 로그에 남는다(실패해도 갱신은 계속한다).
 *
 * 실행: KR_RELAY_SECRET=... npm run check:relay   (KR_RELAY는 자동으로 supabase로 켠다)
 */
import "./lib/load-env";
import { krFetch } from "../src/lib/ingest/kr-fetch";

process.env.KR_RELAY = "supabase";

async function main() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const diagUrl = new URL("/functions/v1/kr-relay", base);
  diagUrl.searchParams.set("diag", "1");
  diagUrl.searchParams.set("forceFunctionRegion", "ap-northeast-2");
  const diag = await fetch(diagUrl, {
    headers: {
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "x-relay-secret": process.env.KR_RELAY_SECRET ?? "",
      "x-region": "ap-northeast-2",
    },
  });
  console.log(`중계기 진단: ${diag.status} ${await diag.text()}`);

  const checks = [
    {
      label: "공공데이터포털 API",
      url: `https://apis.data.go.kr/1613000/HWSPR02/rsdtRcritNtcList?serviceKey=${encodeURIComponent(process.env.DATA_GO_KR_API_KEY ?? "")}&pageNo=1&numOfRows=1&_type=json`,
    },
    {
      label: "청약홈 분양정보 API",
      url: `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail?page=1&perPage=1&returnType=JSON&serviceKey=${encodeURIComponent(process.env.DATA_GO_KR_API_KEY ?? "")}`,
    },
    {
      label: "마이홈포털 공고 페이지",
      url: "https://www.myhome.go.kr/hws/portal/sch/selectRsdtRcritNtcDetailView.do?pblancId=21160",
    },
  ];
  let ok = diag.ok;
  for (const c of checks) {
    try {
      const res = await krFetch(c.url);
      console.log(`${c.label}: ${res.status} (중계기 리전 ${res.headers.get("x-kr-relay-region")})`);
      ok &&= res.ok;
    } catch (e) {
      console.log(`${c.label}: 실패 — ${e instanceof Error ? e.message : String(e)}`);
      ok = false;
    }
  }
  process.exitCode = ok ? 0 : 1;
}

main();
