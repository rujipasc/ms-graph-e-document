import * as path from "node:path";
import fs from "fs-extra";

import { extractZip } from "../core/zip/zipHelper.js";
import { sortFilesByPrefix, buildCsvRowFromZip } from "../core/file/fileHelper.js";
import { mergePdfs } from "../core/pdf/pdfHelper.js";
import { convertImageToPdf, convertTiffToPdfs } from "../core/image/imageHelper.js";
import { generatePdfFileName } from "../core/file/namingHelper.js";
import { getEmployeeInfo } from "../core/db/dbHelper.js";
import logger from "../utils/logger.js";

export const processZip = async (zipPath, tempDir, outputDir) => {
  const zipBase = path.basename(zipPath, ".zip");
  const extractDir = path.join(tempDir, zipBase);
  await fs.ensureDir(extractDir);

  const extractedFiles = await extractZip(zipPath, extractDir);
  const sortedFiles = sortFilesByPrefix(extractedFiles);
  const pdfList = [];
  for (const file of sortedFiles) {
    const ext = path.extname(file).toLowerCase();
    if (ext === ".pdf") {
      pdfList.push(file);
    } else if ([".jpg", ".jpeg", ".png"].includes(ext)) {
      const outPdf = file + ".pdf";
      await convertImageToPdf(file, outPdf);
      pdfList.push(outPdf);
    } else if (ext === ".tiff" || ext === ".tif") {
      const tiffPdfs = await convertTiffToPdfs(file, extractDir);
      pdfList.push(...tiffPdfs);
    } else {
      const errorMessage = `Unsupported file type: ${file}`;
      logger.error(`❌ ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  const csvRow = buildCsvRowFromZip(path.basename(zipPath));
  try {
    const emp = await getEmployeeInfo(csvRow.EmpID);
    csvRow.FirstName = emp.FIRST_NAME_TH;
    csvRow.LastName = emp.LAST_NAME_TH;
  } catch (err) {
    logger.error(`❌ DB lookup failed for ${csvRow.EmpID}: ${err.message}`);
    throw err;
  }

  const finalPdfName = generatePdfFileName(csvRow.EmpID);
  const finalPdf = path.join(outputDir, finalPdfName);
  await mergePdfs(pdfList, finalPdf);
  csvRow.FileName = finalPdfName;
  return { finalPdf, csvRow };
};
