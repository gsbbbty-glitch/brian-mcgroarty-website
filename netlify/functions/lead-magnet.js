function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, {
      success: false,
      error: "Method not allowed.",
    });
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const {
      name,
      email,
      phone = "",
      asset_slug,
      asset_name,
      audience,
      source,
    } = body;

    if (!name || !email || !asset_slug || !asset_name || !audience || !source) {
      return json(400, {
        success: false,
        error: "Missing required lead magnet fields.",
      });
    }

    const ghlWebhookUrl = process.env.GHL_LEAD_MAGNET_WEBHOOK_URL;

    if (!ghlWebhookUrl) {
      return json(500, {
        success: false,
        error: "Lead magnet webhook URL is not configured.",
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

    const ghlResponse = await fetch(ghlWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const ghlResponseBody = await ghlResponse.text();
    console.log("GHL WEBHOOK RESPONSE STATUS:", ghlResponse.status);
    console.log("GHL WEBHOOK RESPONSE BODY:", ghlResponseBody);

    if (!ghlResponse.ok) {
      return json(502, {
        success: false,
        error: `GoHighLevel webhook failed with status ${ghlResponse.status}.`,
      });
    }

    return json(200, { success: true });
  } catch (err) {
    console.error("LEAD MAGNET FUNCTION ERROR:", err);

    return json(500, {
      success: false,
      error: "Lead magnet submission failed.",
    });
  }
};
