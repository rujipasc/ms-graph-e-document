import mysql from "mysql2/promise";
import { db } from "../../../config/dbConfig.js";

let pool;

const initPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      ...db,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
};


export const getEmployeeInfo = async (empID) => {
  const pool = initPool();
  const [rows] = await pool.query(
    `SELECT EMPLOYEE_ID, FIRST_NAME_TH,	LAST_NAME_TH
    FROM EMP_PERSONAL
    WHERE EMPLOYEE_ID = ?`,
    [empID]
  );
  if (rows.length === 0) throw new Error (`❌ Employee not found: ${empID}`);
  return rows[0];
};

export const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("🧹 MySQL pool closed");
  }
};

// run test ถ้าไฟล์นี้ถูก execute ตรง ๆ (node src/utils/dbHelper.js)
if (import.meta.url === `file://${process.argv[1]}`) {
  getEmployeeInfo(2024573).then(console.log).catch(console.error);
}
