import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function formatLeadBackupEmail(payload) {
  return [
    "A lead magnet submission could not be delivered to GoHighLevel.",
    "",
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone}`,
    `Asset Name: ${payload.asset_name}`,
    `Asset Slug: ${payload.asset_slug}`,
    `Audience: ${payload.audience}`,
    `Source: ${payload.source}`,
    `Received At: ${payload.received_at}`,
  ].join("\n");
}

async function sendBackupLeadEmail(payload) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const backupEmailTo = process.env.BACKUP_LEAD_EMAIL_TO;
  const backupEmailFrom = process.env.BACKUP_LEAD_EMAIL_FROM;

  if (!resendApiKey || !backupEmailTo || !backupEmailFrom) {
    throw new Error("Backup email environment variables are not configured.");
  }

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: backupEmailFrom,
      to: backupEmailTo,
      subject: `Backup Lead Magnet Submission: ${payload.asset_name}`,
      text: formatLeadBackupEmail(payload),
    }),
  });

  const emailResponseText = await emailResponse.text();
  console.log("BACKUP EMAIL RESPONSE STATUS:", emailResponse.status);
  console.log("BACKUP EMAIL RESPONSE BODY:", emailResponseText);

  if (!emailResponse.ok) {
    throw new Error(`Backup email failed with status ${emailResponse.status}`);
  }
}

app.post("/lead-magnet", async (req, res) => {
  try {
    const {
      name,
      email,
      phone = "",
      asset_slug,
      asset_name,
      audience,
      source,
    } = req.body;

    if (!name || !email || !asset_slug || !asset_name || !audience || !source) {
      return res.status(400).json({
        success: false,
        error: "Missing required lead magnet fields.",
      });
    }

    const payload = {
      name,
      email,
      phone,
      asset_slug,
      asset_name,
      audience,
      source,
      received_at: new Date().toISOString(),
    };

    console.log("LEAD MAGNET PAYLOAD:", JSON.stringify(payload, null, 2));

    const ghlWebhookUrl =
      "https://services.leadconnectorhq.com/hooks/OhS8DHQpNuyCKBErW3fj/webhook-trigger/e63aee7a-be73-48fc-bae9-093c238975a2";

    try {
      const ghlResponse = await fetch(ghlWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const ghlResponseText = await ghlResponse.text();
      console.log("GHL WEBHOOK RESPONSE BODY:", ghlResponseText);
      console.log("GHL WEBHOOK RESPONSE STATUS:", ghlResponse.status);

      if (ghlResponse.status !== 200) {
        throw new Error(`GoHighLevel webhook failed with status ${ghlResponse.status}`);
      }
    } catch (ghlErr) {
      console.error("GHL WEBHOOK ERROR:", ghlErr);
      console.log("BACKUP LEAD PAYLOAD:", JSON.stringify(payload, null, 2));

      try {
        await sendBackupLeadEmail(payload);
        return res.json({
          success: true,
          backup_notification_sent: true,
        });
      } catch (backupErr) {
        console.error("BACKUP EMAIL ERROR:", backupErr);
        return res.status(502).json({
          success: false,
          error: "GoHighLevel webhook and backup email both failed.",
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("LEAD MAGNET ERROR:", err);
    res.status(500).json({
      success: false,
      error: "Lead magnet submission failed.",
    });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    console.log("REQ BODY MESSAGES:", JSON.stringify(messages, null, 2));

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: messages,
    });

    const reply = response.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error("CHAT ERROR:", err);
    res.status(500).send("Error");
  }
});

app.listen(3001, () => {
  console.log("Server running on port 3001");
});
