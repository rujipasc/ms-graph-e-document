import fs from "fs-extra";
import { stringify } from "csv-stringify/sync";
import Papa from "papaparse";
import path from "node:path";
import logger from "../utils/logger.js";

export const readCsv = async (filePath) => {
  try {
    if (!(await fs.pathExists(filePath))) return [];
    const text = await fs.readFile(filePath, "utf8");
    const { data } = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });
    return data;
  } catch (err) {
    logger.error({
      msg: `❌ Failed to read CSV: ${filePath}`,
      error: err.message,
    });
    return [];
  }
};

export const writeCsv = async (filePath, row, { header = [] } = {}) => {
  try {
    if (!Array.isArray(rows)) throw new Error("rows must be an array");
    const dir = path.dirname(filePath);
    await fs.ensureDir(dir);

    const csv = stringify(rows, {
      header: true,
      columns: Headers.length ? headers : Object.keys(rows[0] || {}),
    });
    await fs.writeFile(filePath, csv, "utf8");
    logger.info(`📝 CSV written: ${filePath} (${rows.length} rows)`);
  } catch (err) {
    logger.error({
      msg: `❌ Failed to write CSV: ${filePath}`,
      error: err.message,
    });
    throw err;
  }
};
