// src/utils/zipTest.js
import path from "path";
import { extractZip } from "./zipHelper.js";

const zipPath = path.join(process.cwd(), "staging", "20197739_20005808_ex_N.zip");
const outputDir = path.join(process.cwd(), "temp", "20197739_extract");

(async () => {
  try {
    const files = await extractZip(zipPath, outputDir);
    console.log("✅ Extracted files:");
    files.forEach(f => console.log("   ", f));
  } catch (err) {
    console.error("❌ Failed:", err.message);
  }
})();