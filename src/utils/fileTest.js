import { buildCsvRowFromZip } from "./fileHelper.js";

const testFiles = [
  "20197739_20005808_ex_N.zip",
  "20245728_20005808_g_P.zip",
  "20284456_20006809_mg_T.zip",
  "20081506_20006809_hr_R.zip",
];

for (const f of testFiles) {
  console.log(buildCsvRowFromZip(f));
}