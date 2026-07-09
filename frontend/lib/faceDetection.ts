let modelsLoaded = false;

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  const faceapi = await import("face-api.js");
  const MODEL_URL = "/models";
  await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)]);
  modelsLoaded = true;
}

export interface FaceResult {
  faceCount: number;
  maxFaceAreaPct: number;
}

const MIN_FACE_AREA_PCT = 0.5;
const ASPECT_MIN = 0.5;
const ASPECT_MAX = 2.0;

export async function detectFaces(imgEl: HTMLImageElement): Promise<FaceResult> {
  const faceapi = await import("face-api.js");

  // 224 gives faces ~40% more pixels than 160 — critical for half-body shots
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 });
  const detections = await faceapi.detectAllFaces(imgEl, options);

  if (detections.length === 0) return { faceCount: 0, maxFaceAreaPct: 0 };

  const imgArea = imgEl.naturalWidth * imgEl.naturalHeight;
  let maxPct = 0;
  let validCount = 0;

  for (const d of detections) {
    const { width, height } = d.box;
    const faceArea = width * height;
    const pct = (faceArea / imgArea) * 100;
    const aspect = width / height;

    if (pct < MIN_FACE_AREA_PCT) continue;
    if (aspect < ASPECT_MIN || aspect > ASPECT_MAX) continue;

    validCount++;
    if (pct > maxPct) maxPct = pct;
  }

  return { faceCount: validCount, maxFaceAreaPct: maxPct };
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
