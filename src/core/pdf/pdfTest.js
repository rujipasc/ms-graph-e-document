import path from "path";
import fs from "fs-extra";
import { mergePdfs } from "./pdfHelper.js";

const inputDir = path.join(process.cwd(), "temp", "converted");
const outputPdf = path.join(process.cwd(), "temp", "final_merged.pdf");

const files = (await fs.readdir(inputDir))
  .filter((f) => f.toLowerCase().endsWith(".pdf"))
  .map((f) => path.join(inputDir, f));

// sort ตาม prefix (1,2,3...) ถ้าอยากให้เรียง
files.sort();

await mergePdfs(files, outputPdf);