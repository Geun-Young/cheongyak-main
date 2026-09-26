// Supabase Edge Function 진입점. 본체와 설명은 handler.ts에 있다.
// 배포: npx supabase functions deploy kr-relay --project-ref <프로젝트 ref> --use-api
// 비밀값: npx supabase secrets set KR_RELAY_SECRET=... (GitHub 저장소 비밀값 KR_RELAY_SECRET과 같은 값)
// SB_REGION은 Supabase가 넣어 주는, 이 함수가 실제로 돈 리전이다.
import { createHandler } from "./handler.ts";

Deno.serve(createHandler(Deno.env.get("KR_RELAY_SECRET") ?? "", Deno.env.get("SB_REGION") ?? "unknown"));
