import { useSyncExternalStore } from "react";

/**
 * localStorage 기반 아주 작은 외부 스토어.
 * 연동 단계에서 Supabase로 교체될 자리라 인터페이스만 단순하게 유지한다.
 */
export function createLocalStore<T>(key: string, initial: T) {
  let cache: { raw: string | null; value: T } | null = null;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (typeof window === "undefined") return initial;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null;
    }
    if (cache && cache.raw === raw) return cache.value;
    let value = initial;
    if (raw) {
      try {
        value = JSON.parse(raw) as T;
      } catch {
        value = initial;
      }
    }
    cache = { raw, value };
    return value;
  };

  const write = (value: T) => {
    try {
      if (value === null || value === undefined) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      // 저장 불가 환경(시크릿 모드 등)에서는 조용히 넘어간다
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  function useStore(): [T, (value: T) => void] {
    const value = useSyncExternalStore(subscribe, read, () => initial);
    return [value, write];
  }

  return { useStore, read, write };
}
