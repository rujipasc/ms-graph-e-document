import fs from "fs-extra";
import * as path from "node:path";
import sharp from "sharp";
import PDFDocument from "pdfkit";
import logger from "../../utils/logger.js"

export const convertImageToPdf = async (imagePath, outputPdfPath) => {
    try {
        const doc = new PDFDocument({ autoFirstPage: false });
        const stream = fs.createWriteStream(outputPdfPath);
        doc.pipe(stream);

        const img = sharp(imagePath);
        const metadata = await img.metadata();

        doc.addPage({ size: [metadata.width, metadata.height] });
        doc.image(imagePath, 0, 0, { width: metadata.width, height: metadata.height })
        doc.end();

        await new Promise((resolve) => stream.on("finish", resolve));

        return outputPdfPath;
    } catch (err) {
        logger.error({
            msg:`❌ Error converting image to PDF: ${imagePath}`, 
            error: err.message,
            stack: err.stack,
            imagePath,
            outputPdfPath,
        });
        throw err;
    }
};

export const convertTiffToPdfs = async (tiffPath, outputDir) => {
    try {
        await fs.ensureDir(outputDir);
        const img = sharp(tiffPath, {pages: -1});
        const metadata = await img.metadata();
        const pageCount = metadata.pages || 1;

        const pdfFiles = [];
        for ( let i = 0; i < pageCount; i++) {
            const outPdf = path.join(outputDir,
            `${path.basename(tiffPath, path.extname(tiffPath))}_page${i + 1}.pdf`
        );

        const pageBuffer = await sharp(tiffPath, { page: i })
            .png()
            .toBuffer();
        const doc = new PDFDocument({ autoFirstPage: false });
        const stream = fs.createWriteStream(outPdf);
        doc.pipe(stream);

        const tmpImg = sharp(pageBuffer);
        const m = await tmpImg.metadata();

        doc.addPage({ size: [m.width, m.height] });
        doc.image(pageBuffer, 0, 0, { width: m.width, height: m.height })
        doc.end();

        await new Promise((resolve) => stream.on("finish", resolve));
        pdfFiles.push(outPdf);
        }
        return pdfFiles;
    } catch(err) {
        logger.error({
            msg: `❌ Error converting TIFF to PDFs: ${tiffPath}`, 
            error: err.message,
            stack: err.stack,
            tiffPath,
            outputDir,
        });
        throw err;
    }
};