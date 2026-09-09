/**
 * 이메일로 사용자를 찾아 관리자로 지정한다.
 * admins 테이블은 일반 사용자에게 권한이 없어서(마이그레이션 0006) 이렇게 서버에서만
 * 추가할 수 있다 — 화면에 "관리자 되기" 버튼을 두면 누구나 누를 수 있으므로 일부러 없다.
 *
 * 실행: npm run grant-admin -- you@example.com
 *      npm run grant-admin -- you@example.com --revoke   (권한 해제)
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요해요.");
  process.exit(1);
}

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const revoke = args.includes("--revoke");

if (!email) {
  console.error("사용법: npm run grant-admin -- you@example.com [--revoke]");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  // listUsers는 페이지네이션이라 이메일로 찾으려면 순회해야 한다(사용자가 적을 때는 1페이지로 충분).
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const user = data.users.find((u) => u.email?.toLowerCase() === email!.toLowerCase());
  if (!user) {
    console.error(`'${email}' 계정을 찾지 못했어요. 먼저 회원가입을 해주세요.`);
    console.error(`\n현재 가입된 계정 ${data.users.length}개:`);
    for (const u of data.users) console.error("  -", u.email);
    process.exit(1);
  }

  if (revoke) {
    const { error: delErr } = await supabase.from("admins").delete().eq("user_id", user.id);
    if (delErr) throw delErr;
    console.log(`${email} 의 관리자 권한을 해제했어요.`);
    return;
  }

  const { error: insErr } = await supabase
    .from("admins")
    .upsert({ user_id: user.id, note: email }, { onConflict: "user_id" });
  if (insErr) throw insErr;

  console.log(`${email} 을(를) 관리자로 지정했어요.`);
  console.log("이제 /admin/ai-drafts 등 관리자 화면에 접근할 수 있어요.");
}

main().catch((e) => {
  console.error("실패:", e.message ?? e);
  process.exit(1);
});
