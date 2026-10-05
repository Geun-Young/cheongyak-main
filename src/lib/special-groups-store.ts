import type { SpecialGroup } from "./types";
import { createLocalStore } from "./store";

/**
 * 수급자 등 대상 계층 체크를 이 기기(localStorage)에만 둔다 — 서버로 보내지 않는다(special-groups.ts 설명).
 * 판정 엔진(서버에서도 import됨)과 분리하려고 훅만 따로 둔다.
 */
const store = createLocalStore<SpecialGroup[] | null>("cheongyak.groups.v1", null);

/** [고른 계층(null이면 아직 답 안 함), 바꾸기] */
export function useSpecialGroups() {
  return store.useStore();
}
