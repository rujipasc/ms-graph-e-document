import fs from "fs-extra";
import { PDFDocument } from "pdf-lib";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import logger from "../../utils/logger.js";

const ENCRYPTED_PDF_MESSAGE =
  "PDF file is encrypted or password-protected. Please re-scan or export without password.";
const ENCRYPTION_ERROR_SIGNATURE =
  "Input document to `PDFDocument.load` is encrypted";
const ALLOW_IGNORE_ENCRYPTED_PDF =
  String(process.env.ALLOW_IGNORE_ENCRYPTED_PDF || "").toLowerCase() === "true";
const RESAVE_PDFS_BEFORE_MERGE =
  String(process.env.RESAVE_PDFS_BEFORE_MERGE || "true").toLowerCase() === "true";
const USE_PYTHON_RESAVER =
  String(process.env.RESAVE_PDFS_USE_PYTHON || "true").toLowerCase() === "true";

const resolvePythonBin = () => {
  const preferredBins = [
    { bin: process.env.RESAVE_PDFS_PYTHON_BIN, reason: "RESAVE_PDFS_PYTHON_BIN" },
    { bin: process.env.PYTHON, reason: "PYTHON" },
  ];

  for (const { bin, reason } of preferredBins) {
    if (!bin) continue;
    if (fs.existsSync(bin)) {
      return bin;
    }
    if (logger?.warn) {
      logger.warn(
        `⚠️ Python binary set via ${reason} not found at ${bin}. Falling back to auto-detect.`
      );
    }
  }

  const venvDir =
    process.env.RESAVE_PDFS_VENV_DIR ||
    path.join(process.cwd(), ".venv");
  const venvCandidates = [
    path.join(venvDir, "bin", "python3"),
    path.join(venvDir, "bin", "python"),
    path.join(venvDir, "Scripts", "python.exe"),
    path.join(venvDir, "Scripts", "python3.exe"),
  ];

  for (const candidate of venvCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "python3";
};

const PYTHON_RESAVE_BIN = resolvePythonBin();
const PYTHON_RESAVE_SCRIPT =
  process.env.RESAVE_PDFS_PYTHON_SCRIPT ||
  path.resolve(process.cwd(), "scripts", "resave_pdf.py");
const PYTHON_RESAVE_TIMEOUT_MS = Number(
  process.env.RESAVE_PDFS_PYTHON_TIMEOUT_MS || 60000
);

const buildTempPdfPath = (filePath) => {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  return path.join(dir, `${base}__resaved-${randomUUID()}.pdf`);
};

const loadPdfWithFallback = async (bytes, filePath, options = {}) => {
  const { forceIgnoreEncryption = false } = options;
  try {
    return await PDFDocument.load(bytes);
  } catch (error) {
    if (error?.message?.includes(ENCRYPTION_ERROR_SIGNATURE)) {
      const canIgnore = forceIgnoreEncryption || ALLOW_IGNORE_ENCRYPTED_PDF;
      if (!canIgnore) {
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

const runPythonResave = (sourcePath, targetPath) =>
  new Promise((resolve, reject) => {
    const child = spawn(PYTHON_RESAVE_BIN, [PYTHON_RESAVE_SCRIPT, sourcePath, targetPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new Error(
          `Python resave timed out after ${PYTHON_RESAVE_TIMEOUT_MS}ms for ${sourcePath}`
        )
      );
    }, PYTHON_RESAVE_TIMEOUT_MS);
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        if (stdout.trim()) {
          logger.debug?.({
            msg: "Python resave stdout",
            stdout: stdout.trim(),
            sourcePath,
          });
        }
        resolve();
      } else {
        const errOutput = (stderr || stdout || "").trim();
        reject(
          new Error(
            `Python resave exited with code ${code} for ${sourcePath}${
              errOutput ? `: ${errOutput}` : ""
            }`
          )
        );
      }
    });
  });

const resavePdfViaPython = async (filePath) => {
  const scriptExists = await fs.pathExists(PYTHON_RESAVE_SCRIPT);
  if (!scriptExists) {
    throw new Error(`Python resave script not found: ${PYTHON_RESAVE_SCRIPT}`);
  }
  const resavedPath = buildTempPdfPath(filePath);
  await runPythonResave(filePath, resavedPath);
  logger.info(`📝 Re-saved PDF copy via python → ${resavedPath}`);
  return resavedPath;
};

const resavePdfWithPdfLib = async (filePath) => {
  const bytes = await fs.readFile(filePath);
  const pdfDoc = await loadPdfWithFallback(bytes, filePath, {
    forceIgnoreEncryption: true,
  });
  const scratchPdf = await PDFDocument.create();
  const copiedPages = await scratchPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
  for (const page of copiedPages) {
    scratchPdf.addPage(page);
  }
  const resavedPath = buildTempPdfPath(filePath);
  await fs.writeFile(resavedPath, await scratchPdf.save());
  logger.info(`📝 Re-saved PDF copy via pdf-lib → ${resavedPath}`);
  return resavedPath;
};

const resavePdfFile = async (filePath) => {
  if (USE_PYTHON_RESAVER) {
    try {
      return await resavePdfViaPython(filePath);
    } catch (error_) {
      logger.warn(
        `⚠️ Python PDF re-save failed for ${filePath}: ${error_.message}. Falling back to pdf-lib.`
      );
    }
  }
  return resavePdfWithPdfLib(filePath);
};

const preparePdfInputs = async (pdfFiles) => {
  if (!RESAVE_PDFS_BEFORE_MERGE) {
    return { workingFiles: pdfFiles, cleanupFiles: [] };
  }

  const workingFiles = [];
  const cleanupFiles = [];
  for (const file of pdfFiles) {
    const resaved = await resavePdfFile(file);
    workingFiles.push(resaved);
    cleanupFiles.push(resaved);
  }
  return { workingFiles, cleanupFiles };
};

export const mergePdfs = async (pdfFiles, outputPdfPath) => {
  const cleanupFiles = [];
  try {
    const { workingFiles, cleanupFiles: prepCleanup } = await preparePdfInputs(pdfFiles);
    cleanupFiles.push(...prepCleanup);
    const mergedPdf = await PDFDocument.create();

    for (const file of workingFiles) {
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
  } finally {
    if (cleanupFiles.length) {
      await Promise.all(
        cleanupFiles.map(async (file) => {
          try {
            await fs.remove(file);
          } catch (error_) {
            logger.warn(`⚠️ Failed to remove temp PDF ${file}: ${error_.message}`);
          }
        })
      );
    }
  }
};
