import fs from "fs-extra";
import { PDFDocument } from "pdf-lib";
import logger from "../../utils/logger.js";

const ENCRYPTED_PDF_MESSAGE = "PDF file is encrypted or password-protected. Please re-scan or export without password.";

export const mergePdfs = async (pdfFiles, outputPdfPath) => {
    try {
        const mergedPdf = await PDFDocument.create();

        for (const file of pdfFiles) {
            const bytes = await fs.readFile(file);
            const pdf = await PDFDocument.load(bytes);
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
        const isEncryptedError = err?.message?.includes("Input document to `PDFDocument.load` is encrypted");
        const errorMessage = isEncryptedError ? ENCRYPTED_PDF_MESSAGE : err.message;
        if (isEncryptedError) {
            err.message = errorMessage;
        }
        logger.error({
            msg:`❌ Error merging PDFs: ${errorMessage}`, 
            error: errorMessage,
        });
        throw err;
    }
}
