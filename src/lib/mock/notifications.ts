import type { Notification } from "../types";

function at(daysAgo: number, hour: number): string {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - daysAgo, hour, 0, 0);
  return d.toISOString();
}

/**
 * 알림 문구 템플릿:
 * "{이름}님이 신청할 수 있는 {공고명} 신청일이 {n}일 남았어요! 몇 순위인지 확인해보기"
 * 개인정보(소득구간 등)는 절대 넣지 않는다.
 */
export const NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    type: "deadline",
    announcementId: "sh-youth-yeoksam",
    message: "김청약님이 신청할 수 있는 청년안심주택 공공임대 (역삼동) 신청일이 1일 남았어요! 몇 순위인지 확인해보기",
    sentAt: at(0, 9),
    read: false,
  },
  {
    id: "n2",
    type: "deadline",
    announcementId: "lh-gangdong-national-2026-2",
    message: "김청약님이 신청할 수 있는 서울강동 국민임대주택 예비입주자 모집 신청일이 2일 남았어요! 몇 순위인지 확인해보기",
    sentAt: at(0, 9),
    read: false,
  },
  {
    id: "n3",
    type: "new_match",
    announcementId: "lh-oryu-happy-youth",
    message: "새 공고가 올라왔어요. 서울 오류동 행복주택 청년 계층 모집, 김청약님은 신청 가능이에요.",
    sentAt: at(1, 18),
    read: false,
  },
  {
    id: "n4",
    type: "new_match",
    announcementId: "lh-jeonse-youth-2026-3",
    message: "새 공고가 올라왔어요. 2026년 3차 청년 전세임대주택 모집, 김청약님은 신청 가능이에요.",
    sentAt: at(3, 10),
    read: true,
  },
  {
    id: "n5",
    type: "deadline",
    announcementId: "sh-longterm-jeonse-43",
    message: "김청약님이 신청할 수 있는 장기전세주택 (43차) 접수가 시작됐어요. 마감까지 11일 남았어요.",
    sentAt: at(4, 9),
    read: true,
  },
];
