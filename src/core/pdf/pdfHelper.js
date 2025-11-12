import fs from "fs-extra";
import { PDFDocument } from "pdf-lib";
import logger from "../../utils/logger.js";

const ENCRYPTED_PDF_MESSAGE =
  "PDF file is encrypted or password-protected. Please re-scan or export without password.";
const ENCRYPTION_ERROR_SIGNATURE =
  "Input document to `PDFDocument.load` is encrypted";
const ALLOW_IGNORE_ENCRYPTED_PDF =
  String(process.env.ALLOW_IGNORE_ENCRYPTED_PDF || "").toLowerCase() === "true";

const loadPdfWithFallback = async (bytes, filePath) => {
  try {
    return await PDFDocument.load(bytes);
  } catch (error) {
    if (error?.message?.includes(ENCRYPTION_ERROR_SIGNATURE)) {
      if (!ALLOW_IGNORE_ENCRYPTED_PDF) {
        logger.warn(`🔐 ${filePath} is encrypted. Merge aborted.`);
        const encryptedError = new Error(ENCRYPTED_PDF_MESSAGE);
        encryptedError.code = "PDF_ENCRYPTED";
        throw encryptedError;
      }

      logger.warn(
        `🔐 ${filePath} flagged as encrypted. Retrying with ignoreEncryption (may produce blank output)...`
      );
      try {
        return await PDFDocument.load(bytes, { ignoreEncryption: true });
      } catch (retryError) {
        retryError.message = ENCRYPTED_PDF_MESSAGE;
        retryError.code = "PDF_ENCRYPTED";
        throw retryError;
      }
    }
    throw error;
  }
};

export const mergePdfs = async (pdfFiles, outputPdfPath) => {
  try {
    const mergedPdf = await PDFDocument.create();

    for (const file of pdfFiles) {
      const bytes = await fs.readFile(file);
      const pdf = await loadPdfWithFallback(bytes, file);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      for (const page of copiedPages) {
        mergedPdf.addPage(page);
      }
    }
    const mergedBytes = await mergedPdf.save();
    await fs.writeFile(outputPdfPath, mergedBytes);
    logger.info(`✅ Merged ${pdfFiles.length} PDFs → ${outputPdfPath}`);
    return outputPdfPath;
  } catch (err) {
    const isEncryptedError =
      err?.message === ENCRYPTED_PDF_MESSAGE ||
      err?.message?.includes(ENCRYPTION_ERROR_SIGNATURE);
    const errorMessage = isEncryptedError ? ENCRYPTED_PDF_MESSAGE : err.message;
    logger.error({
      msg: `❌ Error merging PDFs: ${errorMessage}`,
      error: errorMessage,
    });
    err.message = errorMessage;
    throw err;
  }
};
