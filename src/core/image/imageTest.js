import path from "path";
import fs from "fs-extra";
import { convertImageToPdf, convertTiffToPdfs } from "./imageHelper.js";

const inputDir = path.join(process.cwd(), "temp", "20197739_extract");
const outDir = path.join(process.cwd(), "temp", "converted");

await fs.ensureDir(outDir);

const files = await fs.readdir(inputDir);

for (const f of files) {
  const ext = path.extname(f).toLowerCase();
  const fullPath = path.join(inputDir, f);

  if ([".jpg", ".jpeg", ".png"].includes(ext)) {
    const outPdf = path.join(outDir, `${path.basename(f, ext)}.pdf`);
    const result = await convertImageToPdf(fullPath, outPdf);
    console.log(`✅ Converted ${f} → ${result}`);
  }

  if (ext === ".tiff" || ext === ".tif") {
    const results = await convertTiffToPdfs(fullPath, outDir);
    console.log(`✅ Converted ${f} →`, results);
  }

  if (ext === ".pdf") {
    console.log(`📄 Skipped ${f} (already PDF)`);
  }
}