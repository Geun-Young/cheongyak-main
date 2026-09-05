import { useSyncExternalStore } from "react";
import type { Profile } from "./types";

/**
 * 비회원 빠른 필터 결과. 서버에 보내지 않고 브라우저 세션에만 둔다.
 * 탭을 닫으면 사라진다.
 */
const KEY = "cheongyak.guest.v1";
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Profile | null } = { raw: null, value: null };

function read(): Profile | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (cache.raw === raw) return cache.value;
  let value: Profile | null = null;
  if (raw) {
    try {
      value = JSON.parse(raw) as Profile;
    } catch {
      value = null;
    }
  }
  cache = { raw, value };
  return value;
}

export function saveGuestProfile(p: Profile | null) {
  try {
    if (p) window.sessionStorage.setItem(KEY, JSON.stringify(p));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useGuestProfile(): Profile | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
