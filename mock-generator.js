import fs from 'fs-extra';
import path from 'node:path';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import mapping from './config/mapping.json' with { type: 'json' } ;

console.log("Mapping loaded:", mapping);

const stagingDir = path.join(process.cwd(), 'staging');
await fs.ensureDir(stagingDir);

const empIDs = [
 20245728, 20017863, 20241333,
];
const scanByIDs = [20245728, 20017863, 20241333];

const roleCodes = Object.keys(mapping.role);
const eventCodes = Object.keys(mapping.event);

const mockMeta = Array.from({ length: 100 }, (_, i) => {
  const empID = empIDs[i % empIDs.length];
  const scanBy = scanByIDs[i % scanByIDs.length];
  const roleCode = 'SIT'/*roleCodes[i % roleCodes.length];*/
  const eventCode = eventCodes[i % eventCodes.length];
  return { empID, scanBy, roleCode, eventCode };
});

function createDummyPdf(filePath, text) {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(20).text(text, 100, 100);
    doc.end();
    stream.on("finish", resolve);
  });
}

async function createDummyImage(filePath, text, format = "png") {
  const svgImage = `
    <svg width="200" height="200">
      <rect x="0" y="0" width="200" height="200" fill="lightgrey"/>
      <text x="20" y="100" font-size="20" fill="black">${text}</text>
    </svg>
  `;
  const buffer = Buffer.from(svgImage);
  let sharpImg = sharp(buffer).resize(200, 200);

  if (format === "jpg") await sharpImg.jpeg().toFile(filePath);
  else if (format === "tiff") await sharpImg.tiff().toFile(filePath);
  else await sharpImg.png().toFile(filePath);
}

// main: สร้าง ZIP mock
async function createZip(meta) {
  const { empID, scanBy, roleCode, eventCode } = meta;
  const zipName = `${empID}_${scanBy}_${roleCode}_${eventCode}.zip`;
  const zipPath = path.join(stagingDir, zipName);

  // temp folder ของไฟล์ใน zip
  const tempDir = path.join(stagingDir, `tmp_${empID}`);
  await fs.ensureDir(tempDir);

  // 📄 PDF
  const pdfFile = path.join(tempDir, "doc1.pdf");
  await createDummyPdf(pdfFile, `PDF for ${empID}`);

  // 🖼️ PNG
  const pngFile = path.join(tempDir, "img1.png");
  await createDummyImage(pngFile, `PNG ${empID}`, "png");

  // 🖼️ JPG
  const jpgFile = path.join(tempDir, "img2.jpg");
  await createDummyImage(jpgFile, `JPG ${empID}`, "jpg");

  // 🖼️ TIFF (3 ไฟล์)
  const tiffFiles = [];
  for (let i = 1; i <= 3; i++) {
    const tiffFile = path.join(tempDir, `scan${i}.tiff`);
    await createDummyImage(tiffFile, `TIFF${i} ${empID}`, "tiff");
    tiffFiles.push(tiffFile);
  }

  // สร้าง zip
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip");
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    archive.file(pdfFile, { name: "doc1.pdf" });
    archive.file(pngFile, { name: "img1.png" });
    archive.file(jpgFile, { name: "img2.jpg" });
    for (const t of tiffFiles) {
      archive.file(t, { name: path.basename(t) });
    }

    archive.finalize();
  });

  // ลบ temp files
  await fs.remove(tempDir);

  console.log(`✅ Created ${zipName}`);
}

// run
for (const meta of mockMeta) {
  await createZip(meta);
}

console.log(`\n🎉 Mock ZIP files (with TIFF) created at: ${stagingDir}`);