import { graphRequest } from "../integrations/graphRequest.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

const getDriveInfo = async () => {
  try {
    const data = await graphRequest("get", `${GRAPH_BASE}/users/${process.env.MS_OD_USER}/drive`);
    console.log("✅ OneDrive info:\n", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("❌ Failed to get drive info:", error.response?.data || error.message);
  }
};

getDriveInfo();