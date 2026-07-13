import type { FaceResult } from "./faceDetection";
import type { RawPost } from "./api";

export type SubjectType = "FACE" | "HALF_BODY" | "FULL_BODY" | "NONE";

export interface ScoredPost extends RawPost {
  score: number;
  subjectType: SubjectType;
  faceCount: number;
  faceAreaPct: number;
  proxiedUrl: string;
  frontalScore: number;  // 0-100
  framingScore: number;  // 0-100
  clarityScore: number;  // 0-100
}

export function scorePost(
  post: RawPost,
  result: FaceResult,
  proxiedUrl: string
): ScoredPost {
  const { faceCount, maxFaceAreaPct, bestFace } = result;

  // No face/eyes detected → filter out
  if (faceCount === 0) {
    return {
      ...post, proxiedUrl, score: 0, subjectType: "NONE",
      faceCount: 0, faceAreaPct: 0,
      frontalScore: 0, framingScore: 0, clarityScore: 0,
    };
  }

  let frontalScore = 50;
  let framingScore = 50;
  let clarityScore = 50;

  if (bestFace) {
    frontalScore = Math.round(bestFace.frontalScore * 100);
    framingScore = Math.round(bestFace.framingScore * 100);
    clarityScore = Math.round(bestFace.confidence * 100);
  } else {
    // Fallback: derive rough scores from area
    const areaClamp = Math.min(maxFaceAreaPct / 30, 1);
    framingScore = Math.round(areaClamp * 80);
  }

  // Weighted total: forward-facing is primary signal
  let score = Math.round(
    frontalScore * 0.50 +
    framingScore * 0.30 +
    clarityScore * 0.20
  );

  // Penalize group shots — reduce score proportionally to number of extra faces
  if (faceCount > 1) score = Math.round(score * (1 / faceCount));

  // Penalize very small faces (likely crowd background, not a subject photo)
  if (maxFaceAreaPct < 0.5) score = Math.round(score * 0.3);

  // Subject type based on how much of the image the face occupies
  let subjectType: SubjectType;
  if (maxFaceAreaPct >= 10) subjectType = "FACE";        // close-up portrait
  else if (maxFaceAreaPct >= 2) subjectType = "HALF_BODY"; // face visible + body
  else subjectType = "FULL_BODY";                          // small face, full body

  return {
    ...post, proxiedUrl, score, subjectType,
    faceCount, faceAreaPct: maxFaceAreaPct,
    frontalScore, framingScore, clarityScore,
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
