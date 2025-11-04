import axios from "axios";
import fs from "fs-extra";
import path from "node:path";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env;
const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "ms_token.json");

/**
 * Get Microsoft Graph access token with file-based cache
 * - Reuses token from file if not expired
 * - Requests new token only when expired or missing
 */
export const getAccessToken = async () => {
  try {
    await fs.ensureDir(CACHE_DIR);

    // 🧠 1. Load cache if exists
    if (await fs.pathExists(CACHE_FILE)) {
      const cache = await fs.readJson(CACHE_FILE);
      const now = Date.now();

      if (cache.token && cache.expiresAt > now) {
        const remainingSec = Math.round((cache.expiresAt - now) / 1000);
        logger.debug({
          msg: "♻️ Using cached Microsoft Graph token",
          expiresAt: new Date(cache.expiresAt).toISOString(),
          remainingSec,
        });
        return cache.token;
      }
    }

    // 🔐 2. Request new token
    logger.info("🔐 Requesting new Microsoft Graph token...");
    const res = await axios.post(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        grant_type: "client_credentials",
        scope: "https://graph.microsoft.com/.default",
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { access_token, expires_in } = res.data;
    const expiresAt = Date.now() + (expires_in - 60) * 1000; // minus 60s safety margin

    // 💾 3. Write cache file
    await fs.writeJson(CACHE_FILE, { token: access_token, expiresAt });

    logger.info({
      msg: "✅ Microsoft Graph token obtained successfully",
      expiresInSec: expires_in,
      expiresAt: new Date(expiresAt).toISOString(),
    });

    return access_token;
  } catch (error) {
    logger.error({
      msg: "❌ Failed to obtain Microsoft Graph token",
      error: error.response?.data || error.message,
    });
    throw error;
  }
};

/**
 * Optional: clear expired token manually (for daily cleanup)
 */
export const clearTokenCache = async () => {
  if (await fs.pathExists(CACHE_FILE)) {
    await fs.remove(CACHE_FILE);
    logger.info("🧹 Cleared Microsoft Graph token cache");
  }
};




