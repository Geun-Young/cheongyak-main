"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/profile";
import { Button } from "./ui";

export function FavoriteButton({ id }: { id: string }) {
  const fav = useFavorites();
  const on = fav.has(id);
  return (
    <Button variant="secondary" onClick={() => fav.toggle(id)} aria-pressed={on}>
      <Heart size={17} className={on ? "fill-danger text-danger" : ""} strokeWidth={2.2} />
      {on ? "관심 공고 저장됨" : "관심 공고로 저장"}
    </Button>
  );
}
