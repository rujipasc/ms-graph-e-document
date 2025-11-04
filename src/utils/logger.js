import pino from "pino";
import * as path from "node:path";
import fs from "fs-extra";

const LOG_DIR = path.join(process.cwd(), "logs");
await fs.ensureDir(LOG_DIR);

const isProd = process.env.NODE_ENV === "production";
const isDev = !isProd;

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: null,
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,

    },
    isProd ? pino.destination(path.join(LOG_DIR, "process.log")) : 1 
);

export default logger;


