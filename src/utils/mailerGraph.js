import { graphRequest } from "../integrations/graphRequest.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export const sendMailViaGraph = async ({
  to,
  subject,
  body,
  attachments = [],
}) => {
  const message = {
    message: {
      subject,
      body: {
        contentType: "HTML",
        content: body,
      },
      toRecipients: to.map((addr) => ({ emailAddress: { address: addr } })),
      attachments: attachments.map((a) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.name,
        contentBytes: a.content,
      })),
    },
    saveToSentItems: "true",
  };

  const url = `${GRAPH_BASE}/users/${process.env.MAIL_USER}/sendMail`;
  await graphRequest("post", url, message);
};

// const htmlBody = `
//       <p>สวัสดีครับ</p>
//       <p>นี่คืออีเมลทดสอบจากระบบ Graph API 🎯</p>
//     `;
// try {
//   await sendMailViaGraph({
//     to: ["chrujipas@central.co.th"],
//     subject: "📧 ทดสอบส่งอีเมลผ่าน Graph API",
//     body: htmlBody,
//     //   attachments: [attachment],
//   });

//   console.log("✅ Mail sent successfully!");
// } catch (err) {
//   console.error("❌ Error sending mail:", err.response?.data || err.message);
// }
