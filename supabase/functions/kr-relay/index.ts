// Supabase Edge Function 진입점. 본체와 설명은 handler.ts에 있다.
// 배포: npx supabase functions deploy kr-relay --project-ref <프로젝트 ref> --use-api
// 비밀값: npx supabase secrets set KR_RELAY_SECRET=... (GitHub 저장소 비밀값 KR_RELAY_SECRET과 같은 값)
import { createHandler } from "./handler.ts";

Deno.serve(createHandler(Deno.env.get("KR_RELAY_SECRET") ?? ""));
