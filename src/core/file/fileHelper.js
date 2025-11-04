import * as path from "node:path";
import mapping from "../../../config/mapping.json" with { type: "json" };

export const parseZipFileName = (fileName) => {
  const base = path.basename(fileName, ".zip");
  const parts = base.split("_");

  if (parts.length < 4) {
    throw new Error(`Invalid ZIP file name: ${fileName}`);
  }

  const [empID, scanBy, roleCode, eventCode] = parts;

  //validation
  if (!/^\d+$/.test(empID)) {
    throw new Error(`❌ Invalid empID in filename: ${empID}`);
  }
  if (!/^\d+$/.test(scanBy)) {
    throw new Error(`❌ Invalid scanBy in filename: ${scanBy}`);
  }
  if (!mapping.role[roleCode.toLowerCase()]) {
    throw new Error(`❌ Unknown roleCode: ${roleCode}`);
  }
  if (!mapping.event[eventCode.toUpperCase()]) {
    throw new Error(`❌ Unknown eventCode: ${eventCode}`);
  }

  return {
    empID,
    scanBy,
    roleCode,
    role: mapping.role[roleCode.toLowerCase()] ?? "Unknown",
    eventCode,
    event: mapping.event[eventCode.toUpperCase()] ?? "Unknown",
  };
};

export const buildCsvRowFromZip = (filename) => {
  const meta = parseZipFileName(filename);
  return {
    FileName: "", // จะมาเติมตอน merge PDF เสร็จ (จาก namingHelper)
    ScanBy: meta.scanBy,
    EmpID: meta.empID,
    Role: meta.role,
    Event: meta.event,
    SFID: "", // จะเติมจาก dbHelper
    FirstName: "", // จะเติมจาก dbHelper
    LastName: "", // จะเติมจาก dbHelper
    InfoOnly: "",
    Delete: "",
  };
};

export const getNumericPrefix = (filePath) => {
  const base = path.basename(filePath);
  const m = base.match(/^\s*(\d+)[\s._-]?/); // 1 / 01 / 1. / 1_ / 1-
  return m ? Number.parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
};

export const sortFilesByPrefix = (files) => {
  return [...files].sort((a, b) => {
    const an = getNumericPrefix(a);
    const bn = getNumericPrefix(b);
    if (an !== bn) return an - bn;

    const aName = path.basename(a).toLowerCase();
    const bName = path.basename(b).toLowerCase();
    return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: "base" });
  });
};