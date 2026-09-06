import { MapPin } from "lucide-react";
import type { SupplyUnit } from "@/lib/types";
import { Card } from "./ui";

/**
 * 유닛 위치 카드. 지금은 자리표시(placeholder)만 그린다.
 * TODO(연동): 카카오맵 JS SDK로 address/lat/lng 좌표에 마커를 띄운다.
 * NEXT_PUBLIC_KAKAO_MAP_KEY 환경변수가 준비되면 이 컴포넌트 안에 지도를 붙인다.
 */
export function UnitLocationCard({ unit }: { unit: SupplyUnit }) {
  return (
    <Card>
      <h3 className="text-base font-bold text-ink">위치</h3>
      {unit.address ? (
        <>
          <p className="mt-2 flex items-start gap-2 text-[15px] text-ink">
            <MapPin size={18} className="mt-0.5 shrink-0 text-brand" />
            <span>{unit.address}</span>
          </p>
          <div className="mt-3 grid h-40 place-items-center rounded-lg border border-dashed border-line-strong bg-surface-2 text-sm text-ink-3">
            지도는 준비 중이에요
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-3">위치 확인 중이에요. 공고문 정리가 끝나면 표시돼요.</p>
      )}
    </Card>
  );
}
