import path from "node:path";
import fs from "fs-extra";
import dotenv from "dotenv";
import logger from "../utils/logger.js";
import {
  listDriveItems,
  downloadFile,
  moveFileToArchive,
  moveFileToFailed,
} from "../integrations/graphODHelper.js";
import { processZip } from "../services/processor.js";
import {
  uploadPdfToSP,
  patchSPMetadata,
} from "../integrations/graphSPHelper.js";
import { appendSummaryRow } from "./summaryHelper.js";
import { appendFailLog } from "../utils/failLogger.js";
import { classifyError } from "../utils/errorTypes.js";
import { sendSummaryNotifications } from "./sendSummary.js";
import { parseZipFileName } from "../core/file/fileHelper.js";

dotenv.config();

const BASE_DIR = process.cwd();
const LOCAL_STAGING_DIR = path.join(BASE_DIR, "staging");
const TEMP_DIR = path.join(BASE_DIR, "temp");
const OUTPUT_DIR = path.join(BASE_DIR, "output");
const TEAM_CONFIG_PATH = path.join(BASE_DIR, "config", "team.json");

const prepareDirectories = async () => {
  await fs.ensureDir(LOCAL_STAGING_DIR);
  await fs.ensureDir(TEMP_DIR);
  await fs.ensureDir(OUTPUT_DIR);
};

const loadTeamFolders = async () => {
  return fs.readJson(TEAM_CONFIG_PATH);
};

const fetchZipFiles = async (remotePath) => {
  const items = await listDriveItems(remotePath);
  return items.filter((f) => f.name.toLowerCase().endsWith(".zip"));
};

const handleUploadSuccess = async (team, file, result, uploadRes) => {
  await appendSummaryRow({
    Timestamp: new Date().toISOString(),
    TeamFolder: team?.team_folder || "EDOC-SIT",
    ScanBy: result.csvRow?.ScanBy || "SYSTEM",
    EmpID: result.csvRow?.EmpID || "",
    Role: result.csvRow?.Role || team?.team_folder || "",
    Event: result.csvRow?.Event || "Processed",
    FileName: result.csvRow?.FileName || file.name,
    Status: "Success",
    Message: "Uploaded successfully",
    SharePointUrl: uploadRes?.webUrl || "",
  });

  await moveFileToArchive(team.team_folder, file.name);
  logger.info(`📄 Moved file to archive → ${file.name}`);
};

const handleUploadFailure = async (team, file, result, error_) => {
  logger.error(`❌ Failed to upload to SharePoint: ${error_.message}`);

  await appendSummaryRow({
    Timestamp: new Date().toISOString(),
    TeamFolder: team?.team_folder || "EDOC-SIT",
    ScanBy: result?.csvRow?.ScanBy || "SYSTEM",
    EmpID: result?.csvRow?.EmpID || "",
    Role: result?.csvRow?.Role || team?.team_folder || "",
    Event: result?.csvRow?.Event || "Upload Failed",
    FileName: file.name,
    Status: "Failed",
    Message: error_.message,
    SharePointUrl: "",
  });

  try {
    await moveFileToFailed(team.team_folder, file.name);
    logger.info(`📄 Moved file to OneDrive Failed → ${file.name}`);
  } catch (error_) {
    logger.warn(`⚠️ Failed to move OneDrive failed file: ${error_.message}`);
  }
};

const uploadToSharePoint = async (team, file, result) => {
  try {
    logger.info(`⬆️ Uploading PDF to SharePoint for ${result.csvRow.EmpID}`);
    const uploadRes = await uploadPdfToSP(
      result.csvRow.Role,
      result.csvRow.EmpID,
      result.finalPdf
    );
    logger.info(`✅ Uploaded to SharePoint: ${uploadRes.name}`);

    await patchSPMetadata(
      uploadRes.parentReference.driveId,
      uploadRes.id,
      result.csvRow
    );
    logger.info(`📝 Patched metadata for itemId: ${uploadRes.id}`);

    await handleUploadSuccess(team, file, result, uploadRes);
  } catch (error_) {
    await handleUploadFailure(team, file, result, error_);
  }
};

const moveZipToProcessed = async (localTeamDir, fileName, localZipPath) => {
  const processedDir = path.join(localTeamDir, "processed");
  await fs.ensureDir(processedDir);
  await fs.move(localZipPath, path.join(processedDir, fileName), {
    overwrite: true,
  });
};

const handleProcessingError = async (
  team,
  file,
  localTeamDir,
  localZipPath,
  error_
) => {
  const errorType = classifyError(error_);
  logger.error(`❌ Failed to handle ${file.name}: ${error_.message}`);

  await appendSummaryRow({
    Timestamp: new Date().toISOString(),
    TeamFolder: team?.team_folder || "EDOC-SIT",
    ScanBy: file.name.split("_")[1] || "SYSTEM",
    EmpID: file.name.split("_")[0] || "",
    Role: team?.team_folder || "",
    Event: "Extraction Failed",
    FileName: file.name,
    Status: "Failed",
    Message: error_.message,
    SharePointUrl: "",
  });

  await appendFailLog(path.join(BASE_DIR, "logs"), {
    date: new Date(),
    team: team.team_folder,
    fileName: file.name,
    empId: file.name.split("_")[0] ?? "",
    scanBy: file.name.split("_")[1] ?? "",
    errorType,
    message: error_.message,
  });

  try {
    await moveFileToFailed(team.team_folder, file.name);
    logger.info(`📄 Moved file to OneDrive Failed → ${file.name}`);
  } catch (error_) {
    logger.warn(`⚠️ Failed to move OneDrive failed file: ${error_.message}`);
  }

  const failedDir = path.join(localTeamDir, "failed");
  await fs.ensureDir(failedDir);
  await fs.move(localZipPath, path.join(failedDir, file.name), {
    overwrite: true,
  });
};

const processZipEntry = async (
  team,
  file,
  remotePath,
  localTeamDir,
  index,
  total
) => {
  const remoteFile = `${remotePath}/${file.name}`;
  const localZipPath = path.join(localTeamDir, file.name);

  try {
    const meta = parseZipFileName(file.name);
    logger.info(
      `🧾 Valid ZIP filename detected → EmpID: ${meta.empID}, ScanBy: ${meta.scanBy}, Role: ${meta.roleCode}, Event: ${meta.eventCode}`
    );
  } catch (error_) {
    const baseName = path.basename(file.name, ".zip");
    const parts = baseName.split("_");
    const rawEmpId = parts[0] || "";
    const rawScanBy = parts[1] || "";

    logger.warn(
      `⚠️ Skipped invalid ZIP filename: ${file.name} (${error_.message})`
    );
    await appendSummaryRow({
      Timestamp: new Date().toISOString(),
      TeamFolder: team?.team_folder || "EDOC-SIT",
      ScanBy: rawScanBy,
      EmpID: rawEmpId,
      Role: team?.team_folder || "",
      Event: "FilenameValidation",
      FileName: file.name,
      Status: "Failed",
      Message: error_.message,
      SharePointUrl: "",
    });
    try {
      await moveFileToFailed(team.team_folder, file.name);
      logger.info(`📦 Moved invalid ZIP to OneDrive Failed → ${file.name}`);
    } catch (error_) {
      logger.warn(
        `⚠️ Failed to move invalid ZIP to Failed: ${error_.message}`
      );
    }
    return; // ⛔ skip ไฟล์นี้ไปเลย
  }

  logger.info(`[${index + 1}/${total}] ⬇️ Downloading ${file.name}`);
  try {
    await downloadFile(remoteFile, localTeamDir);
    logger.info(`📦 Saved ZIP → ${localZipPath}`);

    logger.info(`🧩 Processing ZIP → ${file.name}`);
    const result = await processZip(localZipPath, TEMP_DIR, OUTPUT_DIR);

    logger.info(`✅ PDF Created → ${result.finalPdf}`);
    logger.info(`📑 Metadata → ${JSON.stringify(result.csvRow)}`);

    await uploadToSharePoint(team, file, result);
    await moveZipToProcessed(localTeamDir, file.name, localZipPath);
  } catch (error_) {
    await handleProcessingError(team, file, localTeamDir, localZipPath, error_);
  }
};

const processTeam = async (team) => {
  const remotePath = `${team.team_folder}/Employee Document/Active/Staging`;
  const localTeamDir = path.join(LOCAL_STAGING_DIR, team.team_folder);
  await fs.ensureDir(localTeamDir);

  logger.info(`\n📁 Checking OneDrive path: ${remotePath}`);
  try {
    const zipFiles = await fetchZipFiles(remotePath);

    if (zipFiles.length === 0) {
      logger.warn(`⚠️ No ZIP files found for ${team.team_folder}`);
      return;
    }

    logger.info(`✅ Found ${zipFiles.length} ZIP file(s) in ${team.team_folder}`);

    for (const [index, file] of zipFiles.entries()) {
      await processZipEntry(
        team,
        file,
        remotePath,
        localTeamDir,
        index,
        zipFiles.length
      );
    }
  } catch (error_) {
    if (error_.response?.status === 404) {
      logger.warn(`⚠️ Folder not found for ${team.team_folder} → skipped`);
      return;
    }
    logger.error(`❌ Unexpected error for ${team.team_folder}: ${error_.message}`);
  }
};

const cleanupTemporaryDirs = async () => {
  try {
    logger.info("🧹 Cleaning up temporary folders...");
    await fs.emptyDir(LOCAL_STAGING_DIR);
    await fs.emptyDir(TEMP_DIR);
  } catch (error_) {
    logger.warn(`⚠️ Cleanup skipped: ${error_.message}`);
  }
};

const sendSummariesAndCleanOutput = async () => {
  logger.info("\n🎯 All team folders processed successfully!");
  try {
    const { totalGroups, emailsSent } = await sendSummaryNotifications();
    if (totalGroups === 0) {
      logger.info("ℹ️ No summary emails to send (summary.csv empty).");
    } else {
      logger.info("📧 Sending summary notifications...");
      logger.info(
        `✅ Summary emails sent successfully! (${emailsSent}/${totalGroups} recipients)`
      );
    }
  } catch (error_) {
    logger.error(`❌ Failed to send summary notifications: ${error_.message}`);
  } finally {
    try {
      logger.info("🗑️ Clearing output directory...");
      await fs.emptyDir(OUTPUT_DIR);
    } catch (error_) {
      logger.warn(`⚠️ Failed to clear output directory: ${error_.message}`);
    }
  }
};

export const runPipeline = async () => {
  logger.info("🚀 Starting full pipeline (download → process)");

  await prepareDirectories();
  const teamFolders = await loadTeamFolders();

  for (const team of teamFolders) {
    await processTeam(team);
  }

  await cleanupTemporaryDirs();
  await sendSummariesAndCleanOutput();
};
