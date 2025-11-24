import { parse as json2csvParse } from "json2csv";
import { groupSummaryByScanBy, parseGroupKey, SUMMARY_HEADERS } from "./summaryHelper.js";
import { sendMailViaGraph } from "../utils/mailerGraph.js";
import { getUserByEmployeeId } from "../integrations/graphUserHelper.js";
import { generateSummaryEmailTemplate } from "../utils/mailTemplate.js";
import fs from "fs-extra";
import path from "node:path";
import logger from "../utils/logger.js";

export const sendSummaryNotifications = async () => {
  const groups = await groupSummaryByScanBy();
  const entries = Object.entries(groups);
  const totalGroups = entries.length;
  let emailsSent = 0;
  const today = new Date().toISOString().split("T")[0];

  if (totalGroups === 0) {
    return { totalGroups, emailsSent };
  }

  logger.info(`📧 Preparing summary notifications for ${totalGroups} recipients...`);

  for (const [key, records] of entries) {
    const { teamFolder, scanBy } = parseGroupKey(key);

    const csvPath = path.join(
      "output",
      `summary_${teamFolder}_${scanBy}_${today}.csv`
    );
    const normalizedRecords = records.map((r, idx) => ({
      Timestamp: r.Timestamp || "",
      TeamFolder: r.TeamFolder || "",
      ScanBy: r.ScanBy || "",
      EmpID: r.EmpID || "",
      Role: r.Role || "",
      Event: r.Event || "",
      FileName: r.FileName || "",
      Status: r.Status || "",
      Message: r.Message || "",
      SharePointUrl: r.SharePointUrl || "",
      __index: idx,
    }));

    const sortedRecords = [...normalizedRecords]
      .sort((a, b) => {
        const weight = (status) =>
          String(status).toLowerCase() === "success" ? 0 : 1;
        const diff = weight(a.Status) - weight(b.Status);
        if (diff !== 0) return diff;
        return (a.__index ?? 0) - (b.__index ?? 0);
      })
      .map(({ __index, ...record }) => record);

    const csvContent = json2csvParse(sortedRecords, {
      fields: SUMMARY_HEADERS,
      header: true,
    });

    await fs.writeFile(csvPath, csvContent);

    // 1️⃣ ดึงข้อมูล user จาก Graph
    let userEmail = null;
    let scanByName = null;
    try {
      const userInfo = await getUserByEmployeeId(scanBy);
      userEmail = userInfo?.mail || userInfo?.userPrincipalName;
      scanByName = userInfo?.displayName || scanBy || "Team Member";
    } catch (err) {
      logger.warn(`⚠️ Failed to get user info for ${scanBy}: ${err.message}`);
    }

    const email = userEmail || "cghrsystem@central.co.th";

    // 2️⃣ คำนวณ summary stat
    const successCount = records.filter((r) => r.Status === "Success").length;
    const failCount = records.filter((r) => r.Status !== "Success").length;
    const totalCount = records.length;

    // 3️⃣ ใช้ template
    const body = generateSummaryEmailTemplate({
      scanByName,
      formattedDate: today,
      successCount,
      failCount,
      totalCount,
      fileName: path.basename(csvPath),
    });

    try {
      await sendMailViaGraph({
        to: Array.isArray(email) ? email : [email],
        subject: `📊 [HRIS] : ${teamFolder} eDocument Summary - ${today}`,
        body,
        attachments: [
          {
            name: path.basename(csvPath),
            content: Buffer.from(csvContent).toString("base64"),
          },
        ],
      });

      logger.info(
        `📧 Sent summary to ${email} (${records.length} records) for ${teamFolder}`
      );
      emailsSent += 1;
    } catch (error) {
      logger.error({
        msg: `❌ Failed to send summary email to ${email}`,
        error: error.response?.data || error.message,
      });
    }
  }

  return { totalGroups, emailsSent };
};
