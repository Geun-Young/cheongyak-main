"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createLocalStore } from "./store";
import type { Profile } from "./types";
import { EMPTY_PROFILE } from "./profile-data";
import { useAuth } from "./auth";
import {
  addRemoteFavorite,
  fetchRemoteFavorites,
  fetchRemoteProfile,
  removeRemoteFavorite,
  saveRemoteProfile,
} from "./profile-remote";

/*
 * 프로필 훅. 클라이언트 컴포넌트에서만 import할 것.
 * 서버 컴포넌트에서 데모 프로필이나 deriveFacts가 필요하면 profile-data.ts를 쓴다.
 *
 * 저장 위치가 로그인 여부에 따라 갈린다:
 * - 로그인: Supabase user_profiles 테이블(기기가 바뀌어도 유지되고, 서버가 알림을 보낼 때 읽는다)
 * - 비로그인: localStorage(가입 없이 바로 판정해보는 게스트 경험을 그대로 유지)
 * 화면 쪽 인터페이스는 양쪽이 같아서, 이 훅을 쓰는 컴포넌트는 차이를 몰라도 된다.
 */
export { DEMO_PROFILE, EMPTY_PROFILE, profileFromQuery, deriveFacts } from "./profile-data";

const profileStore = createLocalStore<Profile | null>("cheongyak.profile.v1", null);
const favoriteStore = createLocalStore<string[]>("cheongyak.favorites.v1", []);

/**
 * 원격 상태를 "누구 것인지"(userId)와 함께 담는다. 이렇게 하면 로그아웃하거나 계정이
 * 바뀌었을 때 effect 안에서 굳이 상태를 지우지 않아도, 렌더 시점에 userId를 비교해
 * 자동으로 무효가 된다(남의 프로필이 잠깐 보이는 일도 없다).
 */
interface RemoteState<T> {
  userId: string;
  value: T;
}

export function useProfile() {
  const { user, loading: authLoading } = useAuth();
  const [localProfile, setLocalProfile] = profileStore.useStore();
  const [remote, setRemote] = useState<RemoteState<Profile | null> | null>(null);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    let active = true;
    fetchRemoteProfile(userId)
      .then(async (fetched) => {
        if (!active) return;
        if (fetched) {
          setRemote({ userId, value: fetched });
          return;
        }
        // 가입 직후이거나, 게스트로 쓰다가 로그인한 경우.
        // 로컬에 입력해둔 게 있으면 그걸 그대로 서버로 옮겨준다(입력을 두 번 시키지 않는다).
        const seed = profileStore.read();
        if (seed) {
          await saveRemoteProfile(userId, seed);
          if (active) setRemote({ userId, value: seed });
        } else if (active) {
          setRemote({ userId, value: null });
        }
      })
      .catch(() => {
        // 조회에 실패해도 로딩 상태에 갇히지 않게 한다(빈 프로필로 두고 화면은 진행).
        if (active) setRemote({ userId, value: null });
      });
    return () => {
      active = false;
    };
  }, [user]);

  const hasRemoteForUser = user !== null && remote?.userId === user.id;
  const remoteProfile = hasRemoteForUser ? remote.value : null;
  const profile = user ? remoteProfile : localProfile;
  // 로그인은 됐는데 아직 이 사용자의 원격 프로필을 못 읽었으면 로딩 중이다.
  const remoteLoading = user !== null && !hasRemoteForUser;

  const save = useCallback(
    (next: Profile) => {
      if (user) {
        setRemote({ userId: user.id, value: next });
        void saveRemoteProfile(user.id, next);
      } else {
        setLocalProfile(next);
      }
    },
    [user, setLocalProfile],
  );

  const patch = useCallback(
    (partial: Partial<Profile>) => {
      const base = profile ?? EMPTY_PROFILE;
      save({ ...base, ...partial });
    },
    [profile, save],
  );

  return {
    profile,
    isLoggedIn: user !== null,
    /** 세션이나 원격 프로필을 아직 읽는 중. 첫 렌더에 잘못된 화면을 보여주지 않으려면 확인한다 */
    loading: authLoading || remoteLoading,
    save,
    patch,
    /** 로컬 프로필만 지운다. 실제 로그아웃은 useAuth().signOut() */
    logout: () => setLocalProfile(null),
  };
}

export function useFavorites() {
  const { user } = useAuth();
  const [localIds, setLocalIds] = favoriteStore.useStore();
  const [remote, setRemote] = useState<RemoteState<string[]> | null>(null);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    let active = true;
    fetchRemoteFavorites(userId).then((ids) => {
      if (active) setRemote({ userId, value: ids });
    });
    return () => {
      active = false;
    };
  }, [user]);

  const remoteIds = useMemo(
    () => (user && remote?.userId === user.id ? remote.value : []),
    [user, remote],
  );
  const ids = user ? remoteIds : localIds;

  const toggle = useCallback(
    (id: string) => {
      const has = ids.includes(id);
      if (user) {
        setRemote({ userId: user.id, value: has ? remoteIds.filter((x) => x !== id) : [...remoteIds, id] });
        void (has ? removeRemoteFavorite(user.id, id) : addRemoteFavorite(user.id, id));
      } else {
        setLocalIds(has ? localIds.filter((x) => x !== id) : [...localIds, id]);
      }
    },
    [ids, user, remoteIds, localIds, setLocalIds],
  );

  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle,
  };
}
