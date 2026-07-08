let modelsLoaded = false;

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  // Dynamic import — face-api.js must be client-side only
  const faceapi = await import("face-api.js");
  const MODEL_URL = "/models";
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

export interface FaceResult {
  faceCount: number;
  maxFaceAreaPct: number; // largest face as % of total image area
}

export async function detectFaces(imgEl: HTMLImageElement): Promise<FaceResult> {
  const faceapi = await import("face-api.js");

  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });
  const detections = await faceapi.detectAllFaces(imgEl, options);

  if (detections.length === 0) return { faceCount: 0, maxFaceAreaPct: 0 };

  const imgArea = imgEl.naturalWidth * imgEl.naturalHeight;
  let maxPct = 0;

  for (const d of detections) {
    const faceArea = d.box.width * d.box.height;
    const pct = (faceArea / imgArea) * 100;
    if (pct > maxPct) maxPct = pct;
  }

  return { faceCount: detections.length, maxFaceAreaPct: maxPct };
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
