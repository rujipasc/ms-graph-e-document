import logger from "./src/utils/logger.js";
import { closePool } from "./src/core/db/dbHelper.js";
import { runPipeline } from "./src/services/processorIndex.js";

const shutdown = async (code) => {
  try {
    await closePool();
  } catch (err) {
    logger.warn(`⚠️ Failed to close DB pool: ${err.message}`);
  }
  try {
    await logger.flush?.();
  } catch (err) {
    logger.warn(`⚠️ Failed to flush logger: ${err.message}`);
  }
  process.exit(code);
};

const main = async () => {
  try {
    await runPipeline();
    logger.info("✅ Pipeline completed successfully!");
    await shutdown(0);
  } catch (error) {
    logger.error(`🚨 Pipeline crashed: ${error.message}`);
    await shutdown(1);
  }
};

main();
