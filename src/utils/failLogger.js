import fs from "fs-extra";
import * as path from "node:path";
import logger from "./logger.js";

const HEADERS = [
    "Date",
    "Team",
    "FileName",
    "EmpID",
    "ScanBy",
    "ErrorType",
    "Message",
];

export const appendFailLog = async (logsDir, payload) => {
    const dt = payload.date ?? new Date();
    const month = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const csvPath = path.join(logsDir, `fail_${month}.csv`);

    try {
        await fs.ensureDir(logsDir);

        const exists = await fs.pathExists(csvPath);
        if (!exists) {
            await fs.outputFile(csvPath, HEADERS.join(",") + "\n", "utf-8");
        }

        const row = [
            dt.toISOString(),
            payload.team ?? "",
            payload.fileName ?? "",
            payload.empId ?? "",
            payload.scanBy ?? "",
            payload.errorType ?? "",
            (payload.message ?? "").replaceAll("\n", " ").replaceAll(";", ","),
        ].join(";") + "\n";

        await fs.appendFile(csvPath, row, "utf-8");
        logger.info(`📝 Logged fail: ${csvPath}`);
    } catch (err) {
        logger.error(`❌ Failed to append fail log: , ${err.message}`);
    }
};