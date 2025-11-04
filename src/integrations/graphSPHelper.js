import path from "node:path";
import fs from "fs-extra";
import logger from "../utils/logger.js";
import { maybeLogGraph } from "../utils/graphLogger.js";
import { graphRequest } from "../integrations/graphRequest.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const { MS_SITE_ID, MS_SP_DRIVE_ID } = process.env;

export const ensureSPFolder = async (role, empId) => {
  const base = `${GRAPH_BASE}/sites/${MS_SITE_ID}/drives/${MS_SP_DRIVE_ID}`;

  // helper: ensure child under parentPath ("" means root)
  const ensure = async (parentPath, name) => {
    const fullPath = parentPath ? `${parentPath}/${name}` : name;

    // 1) try GET
    try {
      await graphRequest("get", `${base}/root:/${fullPath}`, null, {
        silentStatuses: [404],
      });
      logger.info(`📁 Exists: ${fullPath}`);
      return;
    } catch (err) {
      if (err.response?.status !== 404) throw err;
    }

    // 2) create via POST /children of parent
    const postUrl = parentPath
      ? `${base}/root:/${parentPath}:/children`
      : `${base}/root/children`;

    await graphRequest("post", postUrl, { 
      name, 
      folder: {}, 
      "@microsoft.graph.conflictBehavior": "rename" 
    });
    logger.info(`📂 Created: ${fullPath}`);
  };

  try {
    await ensure("", role);
    await ensure(role, String(empId));
  } catch (err) {
    logger.warn(
      `⚠️ Folder ensure warning for ${role}/${empId}: ${err.message}`
    );
  }

  return `${role}/${empId}`;
};

// Debug function
export const listSPDrives = async () => {
  const url = `${GRAPH_BASE}/sites/${process.env.MS_SITE_ID}/drives`;
  const data = await graphRequest("get", url);
  for (const d of data.value) {
    console.log(`📂 ${d.name} → ${d.id}`);
  }
  await maybeLogGraph("listSPDrives", data);
};

export const listSPFields = async () => {
  const base = `${GRAPH_BASE}/sites/${MS_SITE_ID}/drives/${MS_SP_DRIVE_ID}`;
  const url = `${base}/list/columns`;

  try {
    const data = await graphRequest("get", url);
    for (const f of data.value) {
      console.log(`${f.displayName} → ${f.name}`);
    }
    console.log("📋 SharePoint eDocuments Columns:");
    await maybeLogGraph("listSPFields", data);
  } catch (err) {
    console.error(
      "❌ Failed to list SP fields:",
      err.response?.data || err.message
    );
  }
};

export const uploadPdfToSP = async (role, empId, localPdfPath) => {
  const base = `${GRAPH_BASE}/sites/${MS_SITE_ID}/drives/${MS_SP_DRIVE_ID}`;
  const fileName = path.basename(localPdfPath);

  await ensureSPFolder(role, empId);

  const uploadUrl = `${base}/root:/${role}/${empId}/${fileName}:/content`;
  const data = await fs.readFile(localPdfPath);

  const res = await graphRequest("put", uploadUrl, data, {
    headers: { "Content-Type": "application/pdf" },
    maxBodyLength: Infinity,
    responseType: "json",
  });

  logger.info(`⬆️ Uploaded to SP → ${role}/${empId}/${fileName}`);

  await maybeLogGraph("uploadPdfToSP", res);
  return {
    ...res,
    webUrl: res.webUrl || null,
  };
};

export const patchSPMetadata = async (driveId, itemId, metadata) => {

  // 1️⃣ ดึง listItem ID จาก drive item (จำเป็นใน SharePoint)
  const expandUrl = `${GRAPH_BASE}/drives/${driveId}/items/${itemId}?$expand=listItem`;
  const expand = await graphRequest("get", expandUrl);
  const listItemId = expand?.listItem?.id;
  
  if (!listItemId) throw new Error("listItemId not found in drive item expansion");
  // 2️⃣ Patch โดยใช้ endpoint ของ list “eDocuments”
  const patchUrl = `${GRAPH_BASE}/sites/${process.env.MS_SITE_ID}/lists/eDocuments/items/${listItemId}/fields`;

  const payload = {
    OrganizationalIDNumber: metadata.EmpID,
    FirstName: metadata.FirstName || "",
    LastName: metadata.LastName || "",
    DocType: metadata.Event || "",
    ScanBy: metadata.ScanBy || "",
  };

  const res = await graphRequest("patch", patchUrl, payload);
  logger.info(`📝 Patched metadata for listItemId: ${listItemId}`);
  await maybeLogGraph("patchSPMetadata", res);

  return res;
};
