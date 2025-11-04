import fs from "node:fs";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "logs", "graph");

export const logGraphResponse = async (endpoint, data) => {
  if (process.env.DEBUG_GRAPH !== "true") return;
  try {
    const date = new Date();
    const dateStr = date.toISOString().split("T")[0].replaceAll("-", "");
    const filePath = path.join(LOG_DIR, `${dateStr}.log`);

    await fs.promises.mkdir(LOG_DIR, { recursive: true });

    const entry = {
      timestamp: date.toISOString(),
      endpoint,
      response: data,
    };
    await fs.promises.appendFile(
      filePath,
      JSON.stringify(entry, null, 2) + "\n"
    );
  } catch (err) {
    console.error(
      `⚠️ Failed to log Graph API response for ${endpoint}:`,
      err.message
    );
  }
};

export const maybeLogGraph = async (action, data) => {
  if (process.env.DEBUG_GRAPH === "true") {
    await logGraphResponse(action, data);
  }
};