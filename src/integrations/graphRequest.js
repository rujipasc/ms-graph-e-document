import axios from "axios";
import { getAccessToken } from "../integrations/graphAuth.js";
import logger from "../utils/logger.js";

export const graphRequest = async (method, url, data = null, customConfig = {}) => {
  const token = await getAccessToken();
  const { silentStatuses = [], ...axiosConfig } = customConfig;
  const config = {
    method,
    url,
    data,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...axiosConfig.headers,
    },
    responseType: axiosConfig.responseType || "json",
    timeout: axiosConfig.timeout ?? 30000,
    maxRedirects: axiosConfig.maxRedirects ?? 5,
    validateStatus: axiosConfig.validateStatus || ((s) => s < 500),
  };

  try {
    const res = await axios(config);

    if (res.status >= 400) {
      const graphError = new Error(
        res.data?.error?.message ||
          `Graph ${method.toUpperCase()} ${res.status} response`
      );
      graphError.response = {
        status: res.status,
        data: res.data,
      };
      throw graphError;
    }

    // ✅ handle 204 No Content
    if (res.status === 204) {
      return { ok: true, status: 204 };
    }

    return res.data;
  } catch (error) {
    const status = error.response?.status;
    if (!silentStatuses.includes(status)) {
      logger.error({
        msg: `Graph ${method.toUpperCase()} request failed`,
        error: error.response?.data || error.message,
      });
    }
    throw error;
  }
};
