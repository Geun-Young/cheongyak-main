import { createLocalStore } from "./store";
import type { Profile } from "./types";
import { EMPTY_PROFILE } from "./profile-data";

/*
 * 프로필 훅. 클라이언트 컴포넌트에서만 import할 것.
 * 서버 컴포넌트에서 데모 프로필이나 deriveFacts가 필요하면 profile-data.ts를 쓴다.
 */
export { DEMO_PROFILE, EMPTY_PROFILE, profileFromQuery, deriveFacts } from "./profile-data";

const profileStore = createLocalStore<Profile | null>("cheongyak.profile.v1", null);
const favoriteStore = createLocalStore<string[]>("cheongyak.favorites.v1", []);

export function useProfile() {
  const [profile, setProfile] = profileStore.useStore();
  return {
    profile,
    isLoggedIn: profile !== null,
    save: (next: Profile) => setProfile(next),
    patch: (partial: Partial<Profile>) =>
      setProfile({ ...(profile ?? EMPTY_PROFILE), ...partial }),
    logout: () => setProfile(null),
  };
}

export function useFavorites() {
  const [ids, setIds] = favoriteStore.useStore();
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) =>
      setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]),
  };
}
