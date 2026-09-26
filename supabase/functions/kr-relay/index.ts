// Supabase Edge Function 진입점. 본체와 설명은 handler.ts에 있다.
// 배포: npx supabase functions deploy kr-relay --project-ref <프로젝트 ref> --use-api
// SUPABASE_SERVICE_ROLE_KEY는 Supabase가 모든 Edge Function에 자동으로 넣어 준다.
import { createHandler } from "./handler.ts";

Deno.serve(createHandler(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""));
