/**
 * 매일 공고 갱신 — 수집(마이홈포털·청약홈) → 조건 추출 → 자동 승인을 한 번에 돌린다.
 *
 * 어디서 부르나(project.md 25·26번):
 *  - GitHub Actions(.github/workflows/daily-update.yml) — 매일 두 번. 마이홈포털이 해외 IP를 막아서
 *    KR_RELAY=supabase로 서울 리전 중계기를 거친다.
 *  - 이 PC의 Windows 작업 스케줄러(cheongyak-daily-update) — GitHub 쪽이 자리 잡기 전까지의 대안.
 *  - 관리자 화면 "지금 업데이트" 버튼(src/lib/data/update-runner.ts).
 * 이 PC에서 겹쳐 불리면 잠금 파일(logs/.daily-update.lock)이 뒤에 온 실행을 건너뛴다.
 *
 * 한 단계가 실패해도 다음 단계는 돈다 — 수집이 API 장애로 실패해도, 전날 쌓인 초안의
 * 추출·승인은 할 수 있기 때문이다. 대신 하나라도 실패하면 종료 코드를 1로 내서
 * 작업 스케줄러의 "마지막 실행 결과"에 드러나게 한다.
 *
 * 출력은 logs/daily-update-YYYY-MM-DD.log에 이어 붙인다(30일 지난 로그는 지운다).
 *
 * 실행: npm run daily:update
 */
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "logs");
const KEEP_DAYS = 30;
/** 작업 스케줄러·관리자 버튼이 겹쳐 부르면 같은 공고를 두 번 추출한다. 살아 있는 실행이 있으면 새 실행은 그냥 끝난다 */
const LOCK_FILE = path.join(LOG_DIR, ".daily-update.lock");

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** 잠금을 잡으면 true. 다른 실행이 살아 있으면 false */
function acquireLock(): boolean {
  try {
    const { pid } = JSON.parse(readFileSync(LOCK_FILE, "utf8")) as { pid: number };
    if (pid !== process.pid && isAlive(pid)) return false;
  } catch {
    // 잠금 파일이 없거나 깨졌으면 새로 잡는다
  }
  writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  return true;
}

/** "2026-09-26 18:10:03" (KST) */
const kst = (d = new Date()) => d.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });

mkdirSync(LOG_DIR, { recursive: true });
const logFile = path.join(LOG_DIR, `daily-update-${kst().slice(0, 10)}.log`);

function write(text: string) {
  process.stdout.write(text);
  appendFileSync(logFile, text);
}

function removeOldLogs() {
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  for (const name of readdirSync(LOG_DIR)) {
    const m = name.match(/^daily-update-(\d{4}-\d{2}-\d{2})\.log$/);
    if (m && new Date(`${m[1]}T00:00:00+09:00`).getTime() < cutoff) rmSync(path.join(LOG_DIR, name));
  }
}

interface Step {
  label: string;
  script: string;
  args?: string[];
}

const STEPS: Step[] = [
  { label: "공고 수집(마이홈포털)", script: "ingest:myhome" },
  { label: "공고 수집(청약홈)", script: "ingest:applyhome" },
  { label: "조건 추출", script: "extract:conditions" },
  { label: "자동 승인", script: "approve:drafts", args: ["--apply"] },
];

function runStep(step: Step): Promise<number> {
  return new Promise((resolve) => {
    const args = ["run", step.script, ...(step.args?.length ? ["--", ...step.args] : [])];
    // Windows에서 npm은 npm.cmd라 셸을 거쳐야 한다. 인자는 전부 고정값이라 셸 주입 걱정은 없다
    const child = spawn("npm", args, { cwd: ROOT, shell: true, env: process.env });
    child.stdout.on("data", (d: Buffer) => write(d.toString()));
    child.stderr.on("data", (d: Buffer) => write(d.toString()));
    child.on("error", (e) => {
      write(`실행 실패: ${e.message}\n`);
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function main() {
  if (!acquireLock()) {
    write(`\n${kst()} 이미 다른 공고 갱신이 돌고 있어서 이번 실행은 건너뛰어요.\n`);
    return;
  }
  try {
    await runAll();
  } finally {
    rmSync(LOCK_FILE, { force: true });
  }
}

async function runAll() {
  removeOldLogs();
  write(`\n===== 공고 갱신 시작 ${kst()} =====\n`);

  const results: { label: string; code: number; seconds: number }[] = [];
  for (const step of STEPS) {
    write(`\n----- ${step.label} (${kst()}) -----\n`);
    const started = Date.now();
    const code = await runStep(step);
    results.push({ label: step.label, code, seconds: Math.round((Date.now() - started) / 1000) });
  }

  write(`\n===== 공고 갱신 끝 ${kst()} =====\n`);
  for (const r of results) write(`  ${r.code === 0 ? "성공" : `실패(${r.code})`}  ${r.label}  ${r.seconds}초\n`);

  process.exitCode = results.every((r) => r.code === 0) ? 0 : 1;
}

main().catch((e) => {
  write(`갱신 스크립트 오류: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
});
