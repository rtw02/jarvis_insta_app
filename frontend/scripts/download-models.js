const https = require("https");
const fs = require("fs");
const path = require("path");

const BASE =
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

// Only need TinyFaceDetector — smallest model, fast in browser
const FILES = [
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model-shard1",
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
