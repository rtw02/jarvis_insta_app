let modelsLoaded = false;

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  const faceapi = await import("face-api.js");
  const MODEL_URL = "/models";
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

export interface FaceResult {
  faceCount: number;
  maxFaceAreaPct: number;
  descriptors: Float32Array[];
}

const MIN_FACE_AREA_PCT = 0.3; // looser — catches faces further away

export async function detectFaces(imgEl: HTMLImageElement): Promise<FaceResult> {
  const faceapi = await import("face-api.js");
  const imgArea = imgEl.naturalWidth * imgEl.naturalHeight;

  // ── Pass 1: inputSize 224, threshold 0.4 ──
  const opts1 = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
  let rawDetections = await faceapi.detectAllFaces(imgEl, opts1);

  // ── Pass 2: if nothing, retry larger input + lower threshold ──
  if (rawDetections.length === 0) {
    const opts2 = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });
    rawDetections = await faceapi.detectAllFaces(imgEl, opts2);
  }

  if (rawDetections.length === 0) return { faceCount: 0, maxFaceAreaPct: 0, descriptors: [] };

  // Filter by minimum area only — removed aspect ratio (blocks angled faces)
  let maxPct = 0;
  let validCount = 0;

  for (const d of rawDetections) {
    const pct = (d.box.width * d.box.height / imgArea) * 100;
    if (pct < MIN_FACE_AREA_PCT) continue;
    validCount++;
    if (pct > maxPct) maxPct = pct;
  }

  if (validCount === 0) return { faceCount: 0, maxFaceAreaPct: 0, descriptors: [] };

  // ── Descriptor extraction for clustering — optional, fault-tolerant ──
  // Scoring works even if this fails
  const descriptors: Float32Array[] = [];
  try {
    const opts1Again = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
    const withDesc = await faceapi
      .detectAllFaces(imgEl, opts1Again)
      .withFaceLandmarks(true)
      .withFaceDescriptors();

    for (const d of withDesc) {
      const pct = (d.detection.box.width * d.detection.box.height / imgArea) * 100;
      if (pct < MIN_FACE_AREA_PCT) continue;
      descriptors.push(d.descriptor);
    }
  } catch {
    // Landmark/descriptor failed — scoring still intact, clustering just skips this image
  }

  return { faceCount: validCount, maxFaceAreaPct: maxPct, descriptors };
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
