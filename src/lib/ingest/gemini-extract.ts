/**
 * 공고문 PDF -> Gemini로 자격요건 초안 추출.
 *
 * 이 모듈이 만드는 결과는 "초안"이다. announcements.ai_draft(jsonb)에만 저장되고,
 * supply_units.eligibility/tiers/score_rules(실제 판정에 쓰이는 칸)는 절대 직접 건드리지
 * 않는다 — 관리자가 검수 화면에서 "이 유닛에 반영" 버튼을 눌러야 실제로 옮겨진다.
 * (마이그레이션 0003 설명 참고)
 */
import { GoogleGenAI, Type } from "@google/genai";
import type { Condition, Field, Operator, ScoreBand } from "@/lib/types";

const FIELD_ENUM: Field[] = [
  "age", "incomePct", "housingStatus", "noHousingMonths", "residenceRegion",
  "residenceMonths", "maritalStatus", "marriageMonths", "numChildren", "householdSize",
  "hasSubscription", "subscriptionMonths", "paymentCount", "totalDeposit", "totalAssets", "carValue",
];
const OPERATOR_ENUM: Operator[] = ["eq", "neq", "lte", "gte", "in"];

const conditionSchema = {
  type: Type.OBJECT,
  properties: {
    field: { type: Type.STRING, enum: FIELD_ENUM },
    operator: { type: Type.STRING, enum: OPERATOR_ENUM },
    value: { type: Type.STRING, description: "비교값. 숫자/문자열/불리언을 문자열로, in이면 콤마로 구분" },
    label: { type: Type.STRING, description: "사용자에게 보여줄 한국어 문장. 예: '무주택 세대구성원'" },
    help: { type: Type.STRING, description: "미달 시 보여줄 보충 설명(선택)" },
  },
  required: ["field", "operator", "value", "label"],
};

const scoreBandSchema = {
  type: Type.OBJECT,
  properties: {
    gte: { type: Type.NUMBER },
    lte: { type: Type.NUMBER },
    points: { type: Type.NUMBER },
    note: { type: Type.STRING, description: "예: '5년 이상'" },
  },
  required: ["points", "note"],
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    confidence: {
      type: Type.STRING,
      enum: ["high", "medium", "low"],
      description: "이 추출 결과 전체에 대한 확신도. 표가 복잡하거나 조건이 불명확하면 low",
    },
    unitsFound: {
      type: Type.ARRAY,
      description: "공고문에서 발견한 주택형/타입 목록(전용면적, 평형 등으로 구분)",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "예: '전용 36㎡'" },
          eligibility: { type: Type.ARRAY, items: conditionSchema },
          tiers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                rank: { type: Type.NUMBER },
                label: { type: Type.STRING },
                conditions: { type: Type.ARRAY, items: conditionSchema },
              },
              required: ["rank", "label", "conditions"],
            },
          },
          scoreRules: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                field: { type: Type.STRING, enum: FIELD_ENUM },
                bands: { type: Type.ARRAY, items: scoreBandSchema },
              },
              required: ["label", "field", "bands"],
            },
          },
        },
        required: ["name", "eligibility", "tiers", "scoreRules"],
      },
    },
    notes: { type: Type.STRING, description: "추출하며 애매했던 점, 사람이 반드시 확인해야 할 부분" },
  },
  required: ["confidence", "unitsFound", "notes"],
};

const SYSTEM_PROMPT = `너는 한국 공공주택 청약 공고문을 읽고 자격요건을 구조화하는 도우미야.

아래는 사용자 사실(fact) 필드 목록과 의미다. eligibility/tiers/scoreRules의 field는 반드시 이 중 하나여야 한다:
- age: 만 나이(세)
- incomePct: 소득 구간(도시근로자 월평균소득 대비 %, 예: 100은 100% 이하)
- housingStatus: 주택 소유 여부 ("none"=무주택, "owner"=유주택)
- noHousingMonths: 무주택 기간(개월)
- residenceRegion: 거주 지역(시도 이름, 예: "서울")
- residenceMonths: 현 지역 거주 기간(개월)
- maritalStatus: 혼인 상태 ("single"=미혼, "married"=기혼, "engaged"=예비 신혼부부)
- marriageMonths: 혼인 기간(개월)
- numChildren: 미성년 자녀 수(명)
- householdSize: 가구원 수(명)
- hasSubscription: 청약통장 가입 여부(true/false)
- subscriptionMonths: 청약통장 가입 기간(개월)
- paymentCount: 청약통장 납입 횟수(회)
- totalDeposit: 청약통장 납입 총액(만원)
- totalAssets: 총자산(만원)
- carValue: 자동차가액(만원)

규칙:
1. 공고문에 없는 필드를 지어내지 마라. 애매하면 notes에 적고 그 조건은 빼라.
2. 금액은 전부 "만원" 단위 숫자로 변환해라(예: 3억 3,700만원 → 33700).
3. 기간은 전부 "개월" 단위로 변환해라(예: 5년 → 60).
4. eligibility는 "반드시 만족해야 하는" 자격요건만, tiers는 "순위를 가르는" 조건만, scoreRules는 "가점표"만 넣어라.
5. 공고문에 여러 주택형(전용면적별)이 있고 조건이 다르면 unitsFound에 각각 넣어라. 조건이 다 같으면 하나로 묶어도 된다.
6. label은 사람이 읽기 자연스러운 한국어 문장으로(예: "소득 100% 이하", "무주택 세대구성원").
7. 확신이 없는 부분은 confidence를 낮추고 notes에 구체적으로 적어라 — 이건 관리자가 검수할 초안이니 틀려도 되지만, 틀릴 수 있다는 걸 숨기면 안 된다.`;

export type DraftCondition = Omit<Condition, "id">;

export interface DraftTier {
  rank: number;
  label: string;
  conditions: DraftCondition[];
}

export interface DraftScoreRule {
  label: string;
  field: Field;
  bands: ScoreBand[];
}

export interface DraftUnit {
  name: string;
  eligibility: DraftCondition[];
  tiers: DraftTier[];
  scoreRules: DraftScoreRule[];
}

export interface ExtractionDraft {
  confidence: "high" | "medium" | "low";
  unitsFound: DraftUnit[];
  notes: string;
}

/**
 * 무료 티어 쿼터는 **모델별로 따로** 계산된다
 * (quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier, 모델당 하루 20건).
 * 그래서 한 모델이 하루치를 다 쓰면 다음 모델로 넘어가 계속 처리할 수 있다.
 *
 * 순서는 "품질 좋은 것부터". flash-lite는 실제 공고(자격 5·순위 2·가점 3개짜리
 * 복잡한 가점표)로 비교했을 때 3.6-flash와 같은 결과를 냈으므로 대체로 써도 안전하다.
 * GEMINI_MODEL 환경변수를 주면 그 모델만 쓴다.
 */
const MODEL_FALLBACKS = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-flash-lite-latest"];
const MODELS = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : MODEL_FALLBACKS;
const MAX_RETRIES = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 쿼터(분당/일일 요청 한도)가 바닥났을 때 던진다. 배치 호출부가 이걸 보고
 * "이번 실행은 여기서 멈추고 다음에 이어서" 판단할 수 있게 별도 타입으로 구분한다 —
 * 그냥 계속 다음 건으로 넘어가면 남은 건들이 전부 실패로 기록되면서 쿼터만 더 태운다.
 */
export class GeminiQuotaExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiQuotaExhaustedError";
  }
}

function isQuotaError(message: string): boolean {
  return message.includes("429") || message.includes("RESOURCE_EXHAUSTED");
}

/** 한 모델로 한 번 시도한다. 503(과부하)만 재시도하고, 쿼터 초과는 즉시 위로 알린다 */
async function extractWithModel(
  ai: GoogleGenAI,
  model: string,
  base64: string,
): Promise<ExtractionDraft> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "application/pdf", data: base64 } },
              { text: "이 공고문을 읽고 지시사항대로 구조화해줘." },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Gemini가 빈 응답을 반환했어요.");
      return JSON.parse(text) as ExtractionDraft;
    } catch (e) {
      lastError = e;
      const message = e instanceof Error ? e.message : String(e);

      // 쿼터는 하루 단위(모델당 20건)라 기다려도 안 풀린다 — 바로 알려서 다음 모델로 넘어가게 한다.
      if (isQuotaError(message)) throw new GeminiQuotaExhaustedError(message);

      const retryable = message.includes("503") || message.includes("UNAVAILABLE");
      if (!retryable || attempt >= MAX_RETRIES) throw e;
      await sleep(5000 * attempt);
    }
  }
  // 재시도를 모두 소진한 경우. 마지막 실패가 쿼터 문제였다면 그대로 알린다.
  const lastMessage = lastError instanceof Error ? lastError.message : String(lastError);
  if (isQuotaError(lastMessage)) throw new GeminiQuotaExhaustedError(lastMessage);
  throw lastError;
}

/**
 * PDF 바이트를 Gemini에 보내 자격요건 초안을 추출한다.
 * 무료 티어 쿼터가 모델별로 따로 계산되므로, 한 모델이 소진되면 다음 모델로 넘어간다.
 * 후보를 전부 소진하면 GeminiQuotaExhaustedError를 던져 배치를 멈추게 한다.
 */
export async function extractDraftFromPdf(apiKey: string, pdfBytes: Buffer): Promise<ExtractionDraft> {
  const ai = new GoogleGenAI({ apiKey });
  const base64 = pdfBytes.toString("base64");

  let quotaError: GeminiQuotaExhaustedError | null = null;

  for (const model of MODELS) {
    try {
      return await extractWithModel(ai, model, base64);
    } catch (e) {
      if (e instanceof GeminiQuotaExhaustedError) {
        quotaError = e;
        continue; // 이 모델은 오늘 다 썼다. 다음 모델로.
      }
      throw e; // 쿼터 외 오류는 모델을 바꿔도 같을 가능성이 높다.
    }
  }

  throw quotaError ?? new GeminiQuotaExhaustedError("모든 모델의 쿼터가 소진됐어요.");
}
