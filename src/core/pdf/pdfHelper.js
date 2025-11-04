import fs from "fs-extra";
import { PDFDocument } from "pdf-lib";
import logger from "../../utils/logger.js";

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
        logger.error({
            msg:`❌ Error merging PDFs: ${err.message}`, 
            error: err.message,
        });
        throw err;
    }
}