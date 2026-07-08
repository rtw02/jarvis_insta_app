import type { FaceResult } from "./faceDetection";
import type { RawPost } from "./api";

export type SubjectType = "FACE" | "HALF_BODY" | "FULL_BODY" | "NONE";

export interface ScoredPost extends RawPost {
  score: number;
  subjectType: SubjectType;
  faceCount: number;
  faceAreaPct: number;
  proxiedUrl: string;
}

export function scorePost(
  post: RawPost,
  result: FaceResult,
  proxiedUrl: string
): ScoredPost {
  const { faceCount, maxFaceAreaPct } = result;

  let score = 0;
  let subjectType: SubjectType = "NONE";

  if (faceCount > 0) {
    if (maxFaceAreaPct >= 14) {
      subjectType = "FACE";
      score = 100 + maxFaceAreaPct;
    } else if (maxFaceAreaPct >= 4) {
      subjectType = "HALF_BODY";
      score = 75 + maxFaceAreaPct;
    } else {
      subjectType = "FULL_BODY";
      score = 50 + maxFaceAreaPct;
    }
  }

  return {
    ...post,
    score,
    subjectType,
    faceCount,
    faceAreaPct: maxFaceAreaPct,
    proxiedUrl,
  };
}

export const SUBJECT_LABELS: Record<SubjectType, string> = {
  FACE: "CLOSE-UP",
  HALF_BODY: "HALF BODY",
  FULL_BODY: "FULL BODY",
  NONE: "NO SUBJECT",
};

export const SUBJECT_COLORS: Record<SubjectType, string> = {
  FACE: "#00D4FF",
  HALF_BODY: "#00FF88",
  FULL_BODY: "#FF6B35",
  NONE: "#444",
};
