export const generateSummaryEmailTemplate = ({
  scanByName = "Team",
  formattedDate = new Date().toISOString().split("T")[0],
  successCount = 0,
  failCount = 0,
  totalCount = 0,
  fileName = "summary.csv",
} = {}) => {
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>eDocument Summary</title>
    </head>
    <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f5">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff"
                   style="border:1px solid #e0e0e0; margin-top:25px;">
              <!-- Header -->
              <tr>
                <td style="padding:20px; background-color:#f8f9fa;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td>
                        <img src="https://firebasestorage.googleapis.com/v0/b/cg-ses-files-upload.appspot.com/o/hostingImage%2FHRIS_logo.png?alt=media&token=b43e3e65-b7f9-4ac4-a39e-63293d4a2221"
                             alt="SPD Logo" width="48" height="48" />
                      </td>
                      <td style="font-size:20px; font-weight:bold; color:#333; padding-left:15px;">
                        SPD eDocument Summary
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding:20px; color:#333;">
                  <p style="margin:0 0 10px 0;">สวัสดี <strong>${scanByName}</strong>,</p>
                  <p style="margin:0 0 10px 0;">ระบบได้ดำเนินการอัปโหลดเอกสาร e-Document เสร็จสิ้นเรียบร้อยแล้ว</p>
                  <p style="margin:0 0 10px 0;">วันที่ : <strong>${formattedDate}</strong></p>

                  <table width="100%" border="0" cellspacing="0" cellpadding="8"
                         style="border-collapse:collapse; margin-top:10px;">
                    <thead>
                      <tr style="background-color:#333; color:#fff;">
                        <th align="left">รายการ</th>
                        <th align="right">จำนวนไฟล์</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style="border-bottom:1px solid #ddd;">
                        <td>อัปโหลดสำเร็จ</td>
                        <td align="right">${successCount}</td>
                      </tr>
                      <tr style="border-bottom:1px solid #ddd;">
                        <td>อัปโหลดไม่สำเร็จ</td>
                        <td align="right" style="color:#db0030;">${failCount}</td>
                      </tr>
                      <tr>
                        <td><strong>รวมทั้งหมด</strong></td>
                        <td align="right"><strong>${totalCount}</strong></td>
                      </tr>
                    </tbody>
                  </table>

                  <p style="margin-top:20px;">
                    📎 ไฟล์สรุปรายละเอียดแนบมาพร้อมอีเมลนี้<br />
                    <strong style="color:#0078d4;">${fileName}</strong>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color:#f8f9fa; padding:20px; text-align:center; font-size:12px; color:#666;">
                  <p style="margin:0;">อีเมลนี้ถูกส่งจากระบบอัตโนมัติ eDocument System Automation</p>
                  <p style="margin:0;">
                    หากมีข้อสงสัย ติดต่อได้ที่ 
                    <a href="mailto:peoplecare@central.co.th" style="color:#0078d4;">peoplecare@central.co.th</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
};
