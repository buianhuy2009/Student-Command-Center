import nodemailer from "nodemailer";
import { applyApiCors } from "../cors.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_SENDER_EMAIL = "studentos.service@gmail.com";

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

    const senderEmail = String(process.env.SMTP_USER || process.env.GMAIL_SERVICE_USER || DEFAULT_SENDER_EMAIL).trim() || DEFAULT_SENDER_EMAIL;
    const senderHeader = `StudentOS <${senderEmail}>`;

    // 1. Prefer direct Gmail SMTP via studentos.service@gmail.com App Password (works natively for @gmail.com)
    const smtpPass = String(
      process.env.GMAIL_APP_PASSWORD ||
      process.env.SMTP_PASS ||
      process.env.STUDENTOS_MAIL_PASSWORD ||
      ""
    ).replace(/\s+/g, "").trim();
    if (smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: String(process.env.SMTP_HOST || "smtp.gmail.com").trim(),
          port: Number(process.env.SMTP_PORT || 465),
          secure: Number(process.env.SMTP_PORT || 465) === 465,
          auth: {
            user: senderEmail,
            pass: smtpPass,
          },
        });
        const info = await transporter.sendMail({
          from: senderHeader,
          replyTo: senderEmail,
          to: recipient,
          subject: cleanSubject,
          text: cleanText,
          html: cleanHtml,
        });
        return res.status(200).json({
          ok: true,
          delivered: true,
          transport: "smtp",
          from: senderEmail,
          id: info?.messageId || null,
        });
      } catch (smtpErr) {
        console.warn("Gmail SMTP delivery failed, trying next transport:", smtpErr?.message || smtpErr);
      }
    }

    // 2. Next try server-side Gmail OAuth2 refresh token for studentos.service@gmail.com
    const serviceRefreshToken = String(process.env.GMAIL_SERVICE_REFRESH_TOKEN || "").trim();
    const oauthClientId = String(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "").trim();
    const oauthClientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
    if (serviceRefreshToken && oauthClientId && oauthClientSecret) {
      try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: oauthClientId,
            client_secret: oauthClientSecret,
            refresh_token: serviceRefreshToken,
            grant_type: "refresh_token",
          }).toString(),
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json().catch(() => ({}));
          const accessToken = String(tokenData?.access_token || "").trim();
          if (accessToken) {
            const rawMime = [
              `From: ${senderHeader}`,
              `Reply-To: ${senderEmail}`,
              `To: ${recipient}`,
              `Subject: ${encodeMimeHeaderUtf8(cleanSubject)}`,
              "MIME-Version: 1.0",
              'Content-Type: text/html; charset="UTF-8"',
              "",
              cleanHtml,
            ].join("\r\n");
            const gmailServiceRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ raw: encodeBase64UrlUtf8(rawMime) }),
            });
            if (gmailServiceRes.ok) {
              const sent = await gmailServiceRes.json().catch(() => ({}));
              return res.status(200).json({
                ok: true,
                delivered: true,
                transport: "gmail",
                from: senderEmail,
                id: sent?.id || null,
              });
            }
          }
        }
      } catch (oauthErr) {
        console.warn("Gmail service OAuth2 delivery failed:", oauthErr?.message || oauthErr);
      }
    }

    // 3. Next try Resend when configured
    const resendKey = String(process.env.RESEND_API_KEY || "").trim();
    if (resendKey) {
      const from = senderHeader;
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from,
          reply_to: senderEmail,
          to: [recipient],
          subject: cleanSubject,
          text: cleanText,
          html: cleanHtml,
        }),
      });
      if (resendRes.ok) {
        const sent = await resendRes.json().catch(() => ({}));
        return res.status(200).json({ ok: true, delivered: true, transport: "resend", from: senderEmail, id: sent?.id || null });
      }
      const errDetail = await resendRes.text().catch(() => "");
      console.warn("Resend delivery failed, falling back if possible:", errDetail.slice(0, 180));
    }

    // 4. Next try user's Gmail Send API token when provided
    const gmailToken = String(googleAccessToken || "").trim();
    if (gmailToken) {
      const rawMime = [
        `From: ${senderHeader}`,
        `Reply-To: ${senderEmail}`,
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
        return res.status(200).json({ ok: true, delivered: true, transport: "gmail", from: senderEmail, id: sent?.id || null });
      }
    }

    // 5. Honest preview fallback when no server email credential (GMAIL_APP_PASSWORD / RESEND_API_KEY) is configured
    return res.status(200).json({
      ok: true,
      delivered: false,
      transport: "preview",
      from: senderEmail,
      missingEnv: "GMAIL_APP_PASSWORD",
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
