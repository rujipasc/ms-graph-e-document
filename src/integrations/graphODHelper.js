import axios from "axios";
import axiosRetry from "axios-retry";
import fs from "fs-extra";
import path from "node:path";
import logger from "../utils/logger.js";
import { getAccessToken } from "./graphAuth.js";
import { graphRequest } from "../integrations/graphRequest.js";

// ---------------------------------------------------------------------------
// 🧠 CONFIG
// ---------------------------------------------------------------------------
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const { MS_OD_DRIVE_ID } = process.env;

// Retry สำหรับ error ชั่วคราว (network, throttling, 5xx)
axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 1000,
  retryCondition: (error) =>
    error.code === "ECONNRESET" ||
    error.response?.status >= 500 ||
    error.response?.status === 429,
});

// ---------------------------------------------------------------------------
// 🧩 Helper: Encode เฉพาะส่วนของ URL (Graph path ต้อง encode)
// ---------------------------------------------------------------------------
export const encodeGraphPath = (parts) => parts.map(encodeURIComponent).join("/");

// ---------------------------------------------------------------------------
// 📂 List files/folders ภายใต้ path ที่กำหนด
// ---------------------------------------------------------------------------
export const listDriveItems = async (remotePath) => {
  const token = await getAccessToken();
  const url = `${GRAPH_BASE}/drives/${MS_OD_DRIVE_ID}/root:/${encodeGraphPath(
    remotePath.split("/")
  )}:/children`;

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.value;
  } catch (error) {
    logger.error({
      msg: "❌ Failed to list drive items",
      error: error.response?.data || error.message,
    });
    throw error;
  }
};

// ---------------------------------------------------------------------------
// 📥 Download file จาก OneDrive → local directory
// ---------------------------------------------------------------------------
export const downloadFile = async (remotePath, destDir) => {
  const token = await getAccessToken();
  const encodedPath = encodeGraphPath(remotePath.split("/"));
  const url = `${GRAPH_BASE}/drives/${MS_OD_DRIVE_ID}/root:/${encodedPath}:/content`;
  const localPath = path.join(destDir, path.basename(remotePath));

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "arraybuffer",
    });
    await fs.writeFile(localPath, res.data);
    logger.info(`📥 Downloaded file → ${remotePath}`);
    return localPath;
  } catch (error) {
    logger.error({
      msg: "❌ Failed to download file",
      error: error.response?.data || error.message,
    });
    throw error;
  }
};

// ---------------------------------------------------------------------------
// 🗓️ Ensure ว่ามีโฟลเดอร์ Archive/{YYYY-MM} ถ้าไม่มีก็สร้างใหม่
// ---------------------------------------------------------------------------
export const ensureODArchiveMonth = async (teamFolder) => {
  const token = await getAccessToken();
  const now = new Date();
  const monthFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const archivePath = `${teamFolder}/Employee Document/Active/Archive/${monthFolder}`;
  const encodedArchivePath = encodeGraphPath(archivePath.split("/"));

  try {
    await axios.get(`${GRAPH_BASE}/drives/${MS_OD_DRIVE_ID}/root:/${encodedArchivePath}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    logger.info(`📁 Archive month exists: ${archivePath}`);
  } catch (error) {
    if (error.response?.status === 404) {
      const parentPath = `${teamFolder}/Employee Document/Active/Archive`;
      const encodedParent = encodeGraphPath(parentPath.split("/"));
      await axios.post(
        `${GRAPH_BASE}/drives/${MS_OD_DRIVE_ID}/root:/${encodedParent}:/children`,
        {
          name: monthFolder,
          folder: {},
          "@microsoft.graph.conflictBehavior": "rename",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      logger.info(`📂 Created new archive month folder: ${archivePath}`);
    } else {
      logger.error({
        msg: "❌ Failed to ensure archive month",
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }
  return monthFolder;
};

// ---------------------------------------------------------------------------
// 🚀 Move file ไป Archive/{YYYY-MM}
// ---------------------------------------------------------------------------
export const moveFileToArchive = async (teamFolder, fileName) => {
  const archiveMonth = await ensureODArchiveMonth(teamFolder);

  // URL ต้อง encode แต่ path ใน body ห้าม encode
  const srcPath = encodeGraphPath([
    teamFolder,
    "Employee Document",
    "Active",
    "Staging",
    fileName,
  ]);
  const rawDestPath = `${teamFolder}/Employee Document/Active/Archive/${archiveMonth}`;
  const url = `${GRAPH_BASE}/drives/${MS_OD_DRIVE_ID}/root:/${srcPath}?@microsoft.graph.conflictBehavior=replace`;

  try {
    const res = await graphRequest("patch", url, {
      parentReference: { path: `/drive/root:/${rawDestPath}` },
      name: fileName,
    });

    logger.info({
      msg: "📄 Moved file to archive ✅",
      teamFolder,
      fileName,
      destPath: rawDestPath,
      itemId: res?.id || "(no id)",
    });

    return res;
  } catch (error) {
    logger.error({
      msg: "❌ Failed to move file to archive",
      teamFolder,
      fileName,
      error: error.response?.data || error.message,
    });
    throw error;
  }
};

// ---------------------------------------------------------------------------
// 🚨 Move file ไป Failed/{YYYY-MM}
// ---------------------------------------------------------------------------
export const moveFileToFailed = async (teamFolder, fileName) => {
  const token = await getAccessToken();
  const now = new Date();
  const failedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rawDestPath = `${teamFolder}/Employee Document/Active/Failed/${failedMonth}`;

  // encode เฉพาะ URL
  const srcPath = encodeGraphPath([
    teamFolder,
    "Employee Document",
    "Active",
    "Staging",
    fileName,
  ]);
  const encodedCheckPath = encodeGraphPath(rawDestPath.split("/"));
  const url = `${GRAPH_BASE}/drives/${MS_OD_DRIVE_ID}/root:/${srcPath}?@microsoft.graph.conflictBehavior=replace`;

  // Ensure Failed/YYYY-MM exists
  try {
    await axios.get(`${GRAPH_BASE}/drives/${MS_OD_DRIVE_ID}/root:/${encodedCheckPath}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    logger.info(`📁 Failed month exists: ${rawDestPath}`);
  } catch (err) {
    if (err.response?.status === 404) {
      const parentFailed = `${teamFolder}/Employee Document/Active/Failed`;
      const encodedParent = encodeGraphPath(parentFailed.split("/"));
      await axios.post(
        `${GRAPH_BASE}/drives/${MS_OD_DRIVE_ID}/root:/${encodedParent}:/children`,
        {
          name: failedMonth,
          folder: {},
          "@microsoft.graph.conflictBehavior": "rename",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      logger.info(`📂 Created new failed month folder: ${rawDestPath}`);
    } else throw err;
  }

  // Move file → Failed/YYYY-MM
  try {
    const res = await graphRequest("patch", url, {
      parentReference: { path: `/drive/root:/${rawDestPath}` },
      name: fileName,
    });

    logger.info({
      msg: "📄 Moved file to failed ✅",
      teamFolder,
      fileName,
      destPath: rawDestPath,
      itemId: res?.id || "(no id)",
    });

    return res;
  } catch (error) {
    logger.error({
      msg: "❌ Failed to move file to failed",
      teamFolder,
      fileName,
      error: error.response?.data || error.message,
    });
    throw error;
  }
};

// ---------------------------------------------------------------------------
// 🗑️ Delete file from OneDrive
// ---------------------------------------------------------------------------
export const deleteFile = async (remotePath) => {
  const token = await getAccessToken();
  const encodedPath = encodeGraphPath(remotePath.split("/"));
  const url = `${GRAPH_BASE}/drives/${MS_OD_DRIVE_ID}/root:/${encodedPath}`;

  try {
    await axios.delete(url, { headers: { Authorization: `Bearer ${token}` } });
    logger.info(`🗑️ Deleted file → ${remotePath}`);
  } catch (error) {
    logger.error({
      msg: "❌ Failed to delete file",
      error: error.response?.data || error.message,
    });
    throw error;
  }
};
