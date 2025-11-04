import { listDriveItems, downloadFile } from "../integrations/graphHelper.js";
import fs from "fs-extra";
import path from "path";
import logger from "../utils/logger.js";
import dotenv from "dotenv";
dotenv.config();

const LOCAL_STAGING_DIR = path.join(process.cwd(), "staging");
const REMOTE_STAGING_PATH = "EDOC-SIT/Employee Document/Staging";
const teamFolders = await fs.readJson(
  path.join(process.cwd(), "config", "team.json")
);

const lsItem = async () => {
  try {
    // 👇 ตัวอย่าง path (แก้ให้ตรงกับ OneDrive ของคุณ)
    const path = "EDOC-SIT/Employee Document/Active/Staging";

    console.log(`🔍 Listing items from: ${path}`);
    const items = await listDriveItems(path);

    console.log(`✅ Found ${items.length} items`);
    items.forEach((item) => {
      console.log(`📦 ${item.name} (${item.size} bytes)`);
    });
  } catch (err) {
    console.error("❌ Test failed:", err.message);
  }
};

const batchDownload = async () => {
  try {
    logger.info(`🔍 Fetching file list from OneDrive: ${REMOTE_STAGING_PATH}`);
    const items = await listDriveItems(REMOTE_STAGING_PATH);
    logger.info(`✅ Found ${items.length} items`);

    const zipFiles = items.filter((f) => f.name.toLowerCase().endsWith(".zip"));
    logger.info(`✅ Found ${zipFiles.length} ZIP files`);
    await fs.ensureDir(LOCAL_STAGING_DIR);

    for (const [index, file] of zipFiles.entries()) {
      const remoteFile = `${REMOTE_STAGING_PATH}/${file.name}`;
      logger.info(`\n[${index + 1}/${zipFiles.length}] Downloading: ${file.name}`);
      try {
        const localPath = await downloadFile(remoteFile, LOCAL_STAGING_DIR);
        logger.info(`✅ Saved → ${localPath}`)
      } catch (error) {
        logger.error(`❌ Failed to download: ${remoteFile}`, error.message)
      }
    }
    logger.info("🎯 Batch download completed successfully")
  } catch (err) {
    logger.error("❌ Test failed:", err.message);
  }
};

const batchDownloadAllTeams = async () => {
  await fs.ensureDir(LOCAL_STAGING_DIR);

  for (const team of teamFolders) {
    const remotePath = `${team.team_folder}/Employee Document/Active/Staging`;

    logger.info(`\n📁 Checking folder: ${remotePath}`);

    try {
      const items = await listDriveItems(remotePath);
      const zipFiles = items.filter((f) => f.name.toLowerCase().endsWith(".zip"));

      if (zipFiles.length === 0) {
        logger.warn(`⚠️ No ZIP files found in ${remotePath}`);
        continue;
      }

      logger.info(`✅ Found ${zipFiles.length} ZIP file(s) in ${team.team_folder}`);
      const localDir = path.join(LOCAL_STAGING_DIR, team.team_folder);
      await fs.ensureDir(localDir);

      for (const [i, file] of zipFiles.entries()) {
        const remoteFile = `${remotePath}/${file.name}`;
        logger.info(`[${i + 1}/${zipFiles.length}] ⬇️ Downloading: ${file.name}`);
        try {
          const localPath = await downloadFile(remoteFile, localDir);
          logger.info(`✅ Saved → ${localPath}`);
        } catch (err) {
          logger.error(`❌ Failed to download ${remoteFile}: ${err.message}`);
        }
      }
    } catch (err) {
      logger.error(`❌ Failed to list folder ${remotePath}: ${err.message}`);
    }
  }

  logger.info("\n🎯 All team folders processed successfully");
};
