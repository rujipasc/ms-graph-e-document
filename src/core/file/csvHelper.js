import fs from "fs-extra";
import { stringify } from "csv-stringify/sync";
import logger from "../../utils/logger.js";

const HEADERS = [
  "FileName",
  "ScanBy",
  "EmpID",
  "Role",
  "Event",
  "SFID",
  "FirstName",
  "LastName",
  "InfoOnly",
  "Delete"
];

export const appendCsvRow = async (csvPath, rowData) => {
    try {
        const exists = await fs.pathExists(csvPath);
        
        if (!exists) {
            const headerLine = HEADERS.join(",") + "\n";
            await fs.outputFile(csvPath, headerLine, "utf8");
        }

        const rowArr = HEADERS.map((h) => rowData[h] ?? "");
        const line = stringify([rowArr], { header: false });
        await fs.appendFile(csvPath, line, "utf8")
        logger.info(`📝 CSV updated: ${csvPath}`)
    } catch (err) {
        logger.error({
            msg:`❌ Failed to append CSV: ${csvPath}`, 
            error: err.message,
            stack: err.stack,
            csvPath,
            rowKeys: Object.keys(rowData || {}),
        });
        throw err;
    }
};