let faceModelsLoaded = false;

// ── Model loading ─────────────────────────────────────────────────────────────

export async function loadModels(): Promise<void> {
  await loadFaceModels();
}

async function loadFaceModels(): Promise<void> {
  if (faceModelsLoaded) return;
  const faceapi = await import("face-api.js");
  const MODEL_URL = "/models";
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  faceModelsLoaded = true;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BestFaceMetrics {
  areaFraction: number;
  confidence: number;
  frontalScore: number;
  framingScore: number;
}

export interface FaceResult {
  hasPerson: boolean;       // true if ≥1 face detected above area threshold
  faceCount: number;        // landmark-confirmed faces ≥ MIN_FACE_AREA_PCT
  maxFaceAreaPct: number;
  descriptors: Float32Array[];
  bestFace?: BestFaceMetrics;
}

// Face must occupy at least 1% of image area — filters tiny background false positives
const MIN_FACE_AREA_PCT = 1.0;

type Point = { x: number; y: number };

function avg(pts: Point[]): Point {
  const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return { x, y };
}

function computeFrontalScore(positions: Point[], faceWidth: number): number {
  if (faceWidth <= 0) return 0.5;
  const jawCenter = (positions[0].x + positions[16].x) / 2;
  const noseOffset = Math.abs(positions[30].x - jawCenter) / faceWidth;
  const noseScore = Math.max(0, 1 - noseOffset * 2.8);
  const leftEye = avg(positions.slice(36, 42));
  const rightEye = avg(positions.slice(42, 48));
  const eyeTilt = Math.abs(leftEye.y - rightEye.y) / faceWidth;
  const eyeScore = Math.max(0, 1 - eyeTilt * 4);
  return noseScore * 0.7 + eyeScore * 0.3;
}

function computeFramingScore(
  box: { x: number; y: number; width: number; height: number },
  imgW: number, imgH: number
): number {
  const areaFrac = (box.width * box.height) / (imgW * imgH);
  let sizeScore: number;
  if (areaFrac < 0.05) sizeScore = areaFrac / 0.05;
  else if (areaFrac <= 0.65) sizeScore = 1.0;
  else sizeScore = Math.max(0, 1 - (areaFrac - 0.65) / 0.35);
  const cx = (box.x + box.width / 2) / imgW;
  const xScore = Math.max(0, 1 - Math.abs(cx - 0.5) * 2.5);
  const cy = (box.y + box.height / 2) / imgH;
  const yScore = Math.max(0, 1 - Math.abs(cy - 0.38) * 2.2);
  return sizeScore * 0.5 + xScore * 0.3 + yScore * 0.2;
}

// ── Face detection (landmark-gated) ──────────────────────────────────────────
// Every detection must produce valid 68-point landmarks — eliminates false positives.
// Faces < MIN_FACE_AREA_PCT are discarded (removes background art faces).
async function detectLandmarkFaces(imgEl: HTMLImageElement): Promise<{
  faceCount: number;
  maxFaceAreaPct: number;
  descriptors: Float32Array[];
  bestFace?: BestFaceMetrics;
}> {
  const faceapi = await import("face-api.js");
  const imgW = imgEl.naturalWidth;
  const imgH = imgEl.naturalHeight;
  const imgArea = imgW * imgH;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let withAll: any[] = [];

  for (const opts of [
    new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }),
    new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }),
  ]) {
    withAll = await faceapi.detectAllFaces(imgEl, opts).withFaceLandmarks(true).withFaceDescriptors();
    if (withAll.length > 0) break;
  }

  if (withAll.length === 0) return { faceCount: 0, maxFaceAreaPct: 0, descriptors: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const valid = withAll.filter((d: any) => {
    const pct = (d.detection.box.width * d.detection.box.height / imgArea) * 100;
    // Aspect ratio 0.5–2.0: real faces are roughly square; room/object false positives often aren't
    const aspect = d.detection.box.width / d.detection.box.height;
    return pct >= MIN_FACE_AREA_PCT && d.detection.score >= 0.5 && aspect >= 0.5 && aspect <= 2.0;
  });

  if (valid.length === 0) return { faceCount: 0, maxFaceAreaPct: 0, descriptors: [] };

  let maxFaceAreaPct = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  valid.forEach((d: any) => {
    const pct = (d.detection.box.width * d.detection.box.height / imgArea) * 100;
    if (pct > maxFaceAreaPct) maxFaceAreaPct = pct;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const main = valid.reduce((best: any, d: any) => {
    const area = d.detection.box.width * d.detection.box.height;
    return !best || area > best.detection.box.width * best.detection.box.height ? d : best;
  }, null);

  let bestFace: BestFaceMetrics | undefined;
  if (main) {
    const box = main.detection.box;
    bestFace = {
      areaFraction: (box.width * box.height) / imgArea,
      confidence: main.detection.score,
      frontalScore: computeFrontalScore(main.landmarks.positions, box.width),
      framingScore: computeFramingScore({ x: box.x, y: box.y, width: box.width, height: box.height }, imgW, imgH),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const descriptors = valid.map((d: any) => d.descriptor as Float32Array);
  return { faceCount: valid.length, maxFaceAreaPct, descriptors, bestFace };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function detectFaces(imgEl: HTMLImageElement): Promise<FaceResult> {
  const result = await detectLandmarkFaces(imgEl);
  return { hasPerson: result.faceCount > 0, ...result };
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}
