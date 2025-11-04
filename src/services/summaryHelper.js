import fs from "fs-extra";
import path from "node:path";
import { parse } from "json2csv";
import logger from "../utils/logger.js";
import { readCsv } from "../utils/csvUtils.js";

const SUMMARY_PATH = path.join("output", "summary.csv");
export const SUMMARY_HEADERS = [
  "Timestamp",
  "TeamFolder",
  "ScanBy",
  "EmpID",
  "Role",
  "Event",
  "FileName",
  "Status",
  "Message",
  "SharePointUrl",
];

const ensureSummarySchema = async () => {
  if (!(await fs.pathExists(SUMMARY_PATH))) return;

  const content = (await fs.readFile(SUMMARY_PATH, "utf8")).trim();
  if (!content) return;

  const [headerLine] = content.split("\n");
  if (headerLine.includes("SharePointUrl")) return;

  try {
    const rows = await readCsv(SUMMARY_PATH);
    const normalized = rows.map((row) => ({
      Timestamp: row.Timestamp || "",
      TeamFolder: row.TeamFolder || "",
      ScanBy: row.ScanBy || "",
      EmpID: row.EmpID || "",
      Role: row.Role || "",
      Event: row.Event || "",
      FileName: row.FileName || "",
      Status: row.Status || "",
      Message: row.Message || "",
      SharePointUrl: row.SharePointUrl || "",
    }));

    const csv = parse(normalized, { header: true, fields: SUMMARY_HEADERS });
    await fs.writeFile(SUMMARY_PATH, csv + "\n", "utf-8");
    logger.info("🔄 Updated summary.csv schema with SharePointUrl column");
  } catch (error) {
    logger.warn({
      msg: "⚠️ Failed to normalize summary.csv schema",
      error: error.message,
    });
  }
};

export const appendSummaryRow = async (row) => {
  try {
    await ensureSummarySchema();
    const exists = await fs.pathExists(SUMMARY_PATH);
    const finalRow = {
      Timestamp: row.Timestamp ?? "",
      TeamFolder: row.TeamFolder ?? "",
      ScanBy: row.ScanBy ?? "",
      EmpID: row.EmpID ?? "",
      Role: row.Role ?? "",
      Event: row.Event ?? "",
      FileName: row.FileName ?? "",
      Status: row.Status ?? "",
      Message: row.Message ?? "",
      SharePointUrl: row.SharePointUrl ?? "",
    };
    const csv = parse([finalRow], { header: !exists, fields: SUMMARY_HEADERS });
    await fs.appendFile(SUMMARY_PATH, csv + "\n", "utf-8");
    logger.info(`📝 Logged summary: ${row.FileName}`);
  } catch (error) {
    logger.error({
      msg: "❌ Failed to append summary row",
      error: error.message,
    });
  }
};

export const groupSummaryByScanBy = async () => {
  try {
    await ensureSummarySchema();
    const rows = await readCsv(SUMMARY_PATH);
    const groups = {};
    for (const row of rows) {
      const teamFolder = String(row.TeamFolder || "UNKNOWNTEAM").trim();
      const scanBy = String(row.ScanBy || "UNKNOWNSCANBY").trim();
      const key = `${teamFolder}_${scanBy}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({
        ...row,
        TeamFolder: teamFolder,
        ScanBy: scanBy,
        SharePointUrl: row.SharePointUrl || "",
      });
    }

    return groups;
  } catch (error) {
    logger.error({
      msg: "❌ Failed to group summary by ScanBy",
      error: error.message,
    });
    return {};
  }
};

export const parseGroupKey = (key) => {
  const [teamFolder, scanBy] = key.split("_");
  return { teamFolder, scanBy };
};
