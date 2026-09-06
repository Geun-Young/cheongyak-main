import type { AgencyCode } from "./types";

/** 기관 로고 대신 쓰는 모노그램 타일 색상. 상표 사용 이슈를 피하기 위함(README 참고) */
export const AGENCY_STYLE: Record<AgencyCode, { mark: string; bg: string; fg: string }> = {
  LH: { mark: "LH", bg: "#e4f0fb", fg: "#1c5fa8" },
  SH: { mark: "SH", bg: "#e3f4ea", fg: "#1f7a4d" },
  GH: { mark: "GH", bg: "#e9f1fe", fg: "#2b4fa8" },
  IH: { mark: "iH", bg: "#fdeee6", fg: "#b8521d" },
  BMC: { mark: "BMC", bg: "#e8f3f7", fg: "#1f6d8a" },
  PRIVATE: { mark: "민간", bg: "#f1efe9", fg: "#6b6553" },
};
