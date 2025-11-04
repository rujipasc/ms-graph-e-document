import StreamZip from "node-stream-zip";
import fs from "fs-extra";
import path from "node:path";
import logger from "../../utils/logger.js";

export const extractZip = async (zipPath, targetDir) => {
  try {
    const exists = await fs.pathExists(zipPath);
    if (!exists) {
      throw new Error(`Zip file not found: ${zipPath}`);
    }
    await fs.ensureDir(targetDir);

    const zip = new StreamZip.async({ file: zipPath });
    try {
      await zip.extract(null, targetDir);
    } catch (error_) {
      if (
        error_.message.includes("encrypted") ||
        error_.message.includes("password")
      ) {
        throw new Error(`Zip file is password-protected: ${zipPath}`);
      }
      throw error_;
    }
    const files = await fs.readdir(targetDir);
    await zip.close();
    return files.map((f) => path.join(targetDir, f));
  } catch (err) {
    logger.error({
      msg:`❌ Error extracting ZIP: ${zipPath}`, 
      error: err.message,
      stack: err.stack,
      zipPath,
      targetDir,
    });
    throw err;
  }
};
