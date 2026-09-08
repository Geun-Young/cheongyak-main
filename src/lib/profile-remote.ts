"use client";

import type { Profile } from "./types";
import { createClient } from "./supabase/client";

/**
 * 로그인 사용자의 프로필을 Supabase user_profiles 테이블에서 읽고 쓴다.
 * Profile 전체를 profile jsonb 컬럼에 통째로 저장하고, 알림 발송 대상 쿼리에 쓰이는
 * 값(notify_*, onboarding_done)만 별도 컬럼에 중복 저장한다(마이그레이션 0004 참고).
 */

export async function fetchRemoteProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("profile")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.profile || Object.keys(data.profile).length === 0) return null;
  return data.profile as Profile;
}

export async function saveRemoteProfile(userId: string, profile: Profile): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      profile,
      notify_deadline: profile.notifications.deadline,
      notify_new_match: profile.notifications.newMatch,
      onboarding_done: profile.onboardingDone,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function fetchRemoteFavorites(userId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("announcement_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.announcement_id);
}

export async function addRemoteFavorite(userId: string, announcementId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: userId, announcement_id: announcementId });
  if (error) throw error;
}

export async function removeRemoteFavorite(userId: string, announcementId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("announcement_id", announcementId);
  if (error) throw error;
}
