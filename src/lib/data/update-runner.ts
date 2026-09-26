import "server-only";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 관리자 화면의 "지금 업데이트" 버튼 — 공고 갱신(수집 → 조건 추출 → 자동 승인)을 실행하고 상태를 읽는다.
 *
 * 실행 위치는 두 가지다.
 *  - github: GITHUB_ACTIONS_TOKEN이 있으면 GitHub Actions의 daily-update 워크플로를 실행한다.
 *            배포된 서버(Vercel 등)는 오래 도는 작업을 못 하고 해외 IP라, 이 방법만 쓸 수 있다.
 *  - local:  토큰이 없고 이 PC에서 서버를 돌리는 중이면 `npm run daily:update`를 뒤에서 띄운다.
 *            한국 IP라 중계기 없이 된다. 겹침은 scripts/daily-update.ts의 잠금 파일이 막는다.
 */

const WORKFLOW_FILE = "daily-update.yml";
const LOG_DIR = path.join(process.cwd(), "logs");
const LOCK_FILE = path.join(LOG_DIR, ".daily-update.lock");

export type UpdateMode = "github" | "local" | "unavailable";

export function updateMode(): UpdateMode {
  if (process.env.GITHUB_ACTIONS_TOKEN && process.env.GITHUB_REPOSITORY) return "github";
  if (!process.env.VERCEL) return "local";
  return "unavailable";
}

function github(pathname: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${pathname}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_ACTIONS_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
    cache: "no-store",
  });
}

function localRunning(): boolean {
  try {
    const { pid } = JSON.parse(readFileSync(LOCK_FILE, "utf8")) as { pid: number };
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** 가장 최근 로그의 끝부분. 로컬 실행일 때 진행 상황("[19/105] …")을 보여준다 */
function localLogTail(lines = 12): string | null {
  if (!existsSync(LOG_DIR)) return null;
  const latest = readdirSync(LOG_DIR)
    .filter((f) => /^daily-update-\d{4}-\d{2}-\d{2}\.log$/.test(f))
    .sort()
    .at(-1);
  if (!latest) return null;
  const text = readFileSync(path.join(LOG_DIR, latest), "utf8").trimEnd();
  return text.split(/\r?\n/).slice(-lines).join("\n");
}

export interface TriggerResult {
  ok: boolean;
  message: string;
}

export async function triggerUpdate(): Promise<TriggerResult> {
  const mode = updateMode();
  if (mode === "github") {
    const res = await github(`/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: process.env.GITHUB_REF_NAME ?? "main" }),
    });
    if (res.status === 204) return { ok: true, message: "GitHub Actions에서 업데이트를 시작했어요. 몇 초 뒤 아래에 나타나요." };
    return { ok: false, message: `GitHub에서 거절했어요(${res.status}). 토큰 권한(Actions: 쓰기)을 확인하세요.` };
  }
  if (mode === "local") {
    if (localRunning()) return { ok: false, message: "이미 업데이트가 돌고 있어요." };
    // 인자는 전부 고정값이라 셸을 거쳐도 주입 걱정이 없다(Windows에서 npm은 npm.cmd라 셸이 필요하다)
    const child = spawn("npm", ["run", "daily:update"], {
      cwd: process.cwd(),
      shell: true,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    return { ok: true, message: "이 PC에서 업데이트를 시작했어요. 진행 상황이 아래 로그에 나와요." };
  }
  return {
    ok: false,
    message: "이 서버에서는 직접 돌릴 수 없어요. GITHUB_ACTIONS_TOKEN과 GITHUB_REPOSITORY를 설정하세요.",
  };
}

export interface IngestRunRow {
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "partial" | "failed";
  fetched: number | null;
  inserted: number | null;
  updated: number | null;
  closed: number | null;
}

export interface UpdateStatus {
  mode: UpdateMode;
  running: boolean;
  /** github 모드: 가장 최근 워크플로 실행 */
  lastWorkflow?: { status: string; conclusion: string | null; url: string; createdAt: string };
  /** local 모드: 로그 끝부분 */
  logTail?: string | null;
  runs: IngestRunRow[];
  /** 접수 중인 공고의 조건 추출 상태별 개수 */
  drafts: { waiting: number; failed: number; needsReview: number; approved: number };
}

export async function getUpdateStatus(): Promise<UpdateStatus> {
  const mode = updateMode();
  const supabase = createAdminClient();
  const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10); // KST

  const [runsRes, draftsRes] = await Promise.all([
    supabase
      .from("ingest_runs")
      .select("started_at, finished_at, status, fetched, inserted, updated, closed")
      .order("started_at", { ascending: false })
      .limit(5),
    supabase.from("announcements").select("ai_draft_status").gte("apply_end", today),
  ]);
  if (runsRes.error) throw runsRes.error;
  if (draftsRes.error) throw draftsRes.error;

  const drafts = { waiting: 0, failed: 0, needsReview: 0, approved: 0 };
  for (const r of draftsRes.data ?? []) {
    if (r.ai_draft_status === "none" || r.ai_draft_status === "pending") drafts.waiting++;
    else if (r.ai_draft_status === "failed") drafts.failed++;
    else if (r.ai_draft_status === "extracted") drafts.needsReview++;
    else if (r.ai_draft_status === "approved") drafts.approved++;
  }

  const status: UpdateStatus = { mode, running: false, runs: (runsRes.data ?? []) as IngestRunRow[], drafts };

  if (mode === "github") {
    const res = await github(`/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1`);
    if (res.ok) {
      const run = ((await res.json()) as { workflow_runs: Record<string, string | null>[] }).workflow_runs[0];
      if (run) {
        status.lastWorkflow = {
          status: String(run.status),
          conclusion: run.conclusion,
          url: String(run.html_url),
          createdAt: String(run.created_at),
        };
        status.running = run.status !== "completed";
      }
    }
  } else if (mode === "local") {
    status.running = localRunning();
    status.logTail = localLogTail();
  }
  return status;
}
