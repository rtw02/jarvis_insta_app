const https = require("https");
const fs = require("fs");
const path = require("path");

const BASE =
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

const FILES = [
  // Face detection
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model-shard1",
  // Tiny landmark model (required for face alignment before recognition)
  "face_landmark_68_tiny_model-weights_manifest.json",
  "face_landmark_68_tiny_model-shard1",
  // Face recognition (128D embeddings)
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model-shard1",
  "face_recognition_model-shard2",
];

const OUT_DIR = path.join(__dirname, "..", "public", "models");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function download(filename) {
  return new Promise((resolve, reject) => {
    const dest = path.join(OUT_DIR, filename);
    if (fs.existsSync(dest)) {
      console.log(`  ✓ ${filename} (cached)`);
      return resolve();
    }
    const url = `${BASE}/${filename}`;
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          console.log(`  ↓ ${filename}`);
          resolve();
        });
      })
      .on("error", (e) => {
        fs.unlink(dest, () => {});
        reject(e);
      });
  });
}

(async () => {
  console.log("Downloading face-api.js models...");
  for (const f of FILES) {
    await download(f);
  }
  console.log("Done. Models saved to public/models/");
})();
