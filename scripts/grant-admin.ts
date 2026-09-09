/**
 * 사용자를 관리자로 지정한다.
 * admins 테이블은 일반 사용자에게 권한이 없어서(마이그레이션 0006) 이렇게 서버에서만
 * 추가할 수 있다 — 화면에 "관리자 되기" 버튼을 두면 누구나 누를 수 있으므로 일부러 없다.
 *
 * 실행:
 *   npm run grant-admin                        가입한 계정 목록 보기(누가 관리자인지 표시)
 *   npm run grant-admin -- you@example.com     이메일로 지정
 *   npm run grant-admin -- <user-id>           user id로 지정(카카오처럼 이메일이 없는 계정)
 *   npm run grant-admin -- <대상> --revoke     권한 해제
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요해요.");
  process.exit(1);
}

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));
const revoke = args.includes("--revoke");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** 소셜 로그인 계정은 이메일이 없을 수 있어서, 누구인지 알아볼 만한 이름을 만들어 준다 */
function describeUser(u: { email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }): string {
  const meta = u.user_metadata ?? {};
  const name = (meta.name ?? meta.full_name ?? meta.nickname ?? meta.preferred_username) as string | undefined;
  const provider = (u.app_metadata?.provider as string | undefined) ?? "email";
  return [u.email, name, `(${provider})`].filter(Boolean).join(" · ");
}

async function main() {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const { data: adminRows, error: aErr } = await supabase.from("admins").select("user_id");
  if (aErr) throw aErr;
  const adminIds = new Set((adminRows ?? []).map((r) => r.user_id));

  // 대상을 안 주면 목록만 보여준다 — 카카오처럼 이메일이 없는 계정의 id를 확인하는 용도.
  if (!target) {
    if (data.users.length === 0) {
      console.log("아직 가입한 계정이 없어요. 먼저 회원가입을 해주세요.");
      return;
    }
    console.log(`가입한 계정 ${data.users.length}개:\n`);
    for (const u of data.users) {
      const mark = adminIds.has(u.id) ? "[관리자] " : "         ";
      console.log(`${mark}${describeUser(u)}`);
      console.log(`           ${u.id}`);
    }
    console.log("\n관리자로 지정하려면: npm run grant-admin -- <이메일 또는 위 id>");
    return;
  }

  const user = data.users.find(
    (u) => u.id === target || u.email?.toLowerCase() === target.toLowerCase(),
  );
  if (!user) {
    console.error(`'${target}' 계정을 찾지 못했어요.`);
    console.error("인자 없이 실행하면 가입한 계정 목록을 볼 수 있어요: npm run grant-admin");
    process.exit(1);
  }

  if (revoke) {
    const { error: delErr } = await supabase.from("admins").delete().eq("user_id", user.id);
    if (delErr) throw delErr;
    console.log(`${describeUser(user)} 의 관리자 권한을 해제했어요.`);
    return;
  }

  const { error: insErr } = await supabase
    .from("admins")
    .upsert({ user_id: user.id, note: describeUser(user) }, { onConflict: "user_id" });
  if (insErr) throw insErr;

  console.log(`${describeUser(user)} 을(를) 관리자로 지정했어요.`);
  console.log("이제 /admin/ai-drafts 등 관리자 화면에 접근할 수 있어요.");
}

main().catch((e) => {
  console.error("실패:", e.message ?? e);
  process.exit(1);
});
