import { applyApiCors } from "../cors.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function encodeBase64UrlUtf8(input) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeMimeHeaderUtf8(str) {
  return `=?UTF-8?B?${Buffer.from(String(str || ""), "utf8").toString("base64")}?=`;
}

export default async function handler(req, res) {
  if (applyApiCors(req, res, "POST, OPTIONS")) return;
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

  try {
    const { toEmail, subject, text, html, googleAccessToken } = req.body || {};
    const recipient = String(toEmail || "").trim();
    if (!EMAIL_RE.test(recipient)) {
      return res.status(400).json({ error: "Valid recipient email is required.", code: "invalid_email" });
    }

    const cleanSubject = String(subject || "StudentOS Daily Study Brief").trim().slice(0, 200);
    const cleanText = String(text || "").trim();
    const cleanHtml = String(html || "").trim() || `<pre>${cleanText}</pre>`;

    if (!cleanText) {
      return res.status(400).json({ error: "Report body cannot be empty.", code: "empty_body" });
    }

    // 1. Prefer server Resend when configured
    const resendKey = String(process.env.RESEND_API_KEY || "").trim();
    const senderEmail = "studentos.service@gmail.com";
    const senderHeader = `StudentOS <${senderEmail}>`;
    if (resendKey) {
      const from = String(process.env.RESEND_FROM_EMAIL || senderHeader).trim();
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from,
          to: [recipient],
          subject: cleanSubject,
          text: cleanText,
          html: cleanHtml,
        }),
      });
      if (resendRes.ok) {
        const sent = await resendRes.json().catch(() => ({}));
        return res.status(200).json({ ok: true, delivered: true, transport: "resend", id: sent?.id || null });
      }
      const errDetail = await resendRes.text().catch(() => "");
      console.warn("Resend delivery failed, falling back if possible:", errDetail.slice(0, 180));
    }

    // 2. Next try user's Gmail Send API token when provided
    const gmailToken = String(googleAccessToken || "").trim();
    if (gmailToken) {
      const rawMime = [
        `From: ${senderHeader}`,
        `To: ${recipient}`,
        `Subject: ${encodeMimeHeaderUtf8(cleanSubject)}`,
        "MIME-Version: 1.0",
        'Content-Type: text/plain; charset="UTF-8"',
        "",
        cleanText,
      ].join("\r\n");

      const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmailToken}`,
        },
        body: JSON.stringify({ raw: encodeBase64UrlUtf8(rawMime) }),
      });

      if (gmailRes.ok) {
        const sent = await gmailRes.json().catch(() => ({}));
        return res.status(200).json({ ok: true, delivered: true, transport: "gmail", id: sent?.id || null });
      }
    }

    // 3. Honest preview fallback when neither Resend key nor Gmail token can dispatch directly
    return res.status(200).json({
      ok: true,
      delivered: false,
      transport: "preview",
      preview: {
        from: senderEmail,
        to: recipient,
        subject: cleanSubject,
        text: cleanText,
        html: cleanHtml,
      },
    });
  } catch (err) {
    console.error("Daily report handler error:", err);
    return res.status(500).json({ error: err?.message || "Failed to generate daily report" });
  }
}
