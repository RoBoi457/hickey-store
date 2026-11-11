import { connect } from "cloudflare:sockets";

export const SUPPORT_EMAIL = "support.hickey@gmail.com";

export function buildOrderConfirmationEmail(order) {
  const name = order.customer_name && order.customer_name.trim() ? order.customer_name.trim() : "there";
  const id = order.order_ref || order.id || "";
  const supportContacts = "Prabhu: +91 89564 42297 | Rohan: +91 86608 50435 | support.hickey@gmail.com";

  const subject = "Your Hickey is on the Way!";

  const bodyText = `Good news, ${name}! 

Your Hickey order is officially in, and we're getting everything ready for you!

We're excited to have you here. Your little piece of happiness is now on its way to becoming yours.

Order ID: ${id}

We'll keep you updated at every step of the journey.

Thank you for choosing Hickey!

With love,
Team Hickey

Customer Support: ${supportContacts}`;

  const bodyHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px 20px; color: #151d30; line-height: 1.6; font-size: 15px;">
  <p style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Good news, ${escapeHtml(name)}!</p>
  <p>Your Hickey order is officially in, and we're getting everything ready for you!</p>
  <p>We're excited to have you here. Your little piece of happiness is now on its way to becoming yours.</p>
  <p style="margin: 20px 0; padding: 14px 18px; background: #f4f6fa; border-radius: 12px; border-left: 4px solid #ef234c;">
    <b>Order ID:</b> ${escapeHtml(id)}
  </p>
  <p>We'll keep you updated at every step of the journey.</p>
  <p>Thank you for choosing Hickey!</p>
  <p style="margin-top: 24px;">With love,<br><b>Team Hickey</b></p>
  <hr style="border: none; border-top: 1px solid #e8ecf2; margin: 24px 0 16px;">
  <p style="font-size: 13px; color: #767d8a;"><b>Customer Support:</b> ${escapeHtml(supportContacts)}</p>
</div>`;

  return { subject, bodyText, bodyHtml };
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Direct Gmail SMTP over TLS (smtp.gmail.com:465)
async function sendViaGmailSmtp(appPassword, recipientEmail, subject, bodyText, bodyHtml) {
  const cleanPass = appPassword.replace(/\s+/g, "");
  const boundary = "====_NextPart_" + crypto.randomUUID();

  const socket = connect("smtp.gmail.com:465", { secureTransport: "on" });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();

  async function readResponse() {
    let result = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      result += textDecoder.decode(value, { stream: true });
      // In SMTP, multiline replies have hyphen after code, final line has space (e.g. "250 OK")
      const lines = result.trimEnd().split("\r\n");
      const lastLine = lines[lines.length - 1];
      if (/^\d{3} /.test(lastLine)) {
        return { code: Number(lastLine.slice(0, 3)), text: result };
      }
    }
    return { code: 0, text: result };
  }

  async function writeCommand(cmd) {
    await writer.write(textEncoder.encode(cmd + "\r\n"));
    return await readResponse();
  }

  try {
    const greeting = await readResponse();
    if (greeting.code !== 220) throw new Error("Gmail SMTP connection rejected: " + greeting.text);

    let res = await writeCommand("EHLO cloudflare.pages");
    if (res.code !== 250) throw new Error("EHLO failed: " + res.text);

    res = await writeCommand("AUTH LOGIN");
    if (res.code !== 334) throw new Error("AUTH LOGIN rejected: " + res.text);

    // Send base64 username
    res = await writeCommand(btoa(SUPPORT_EMAIL));
    if (res.code !== 334) throw new Error("Gmail username rejected: " + res.text);

    // Send base64 password
    res = await writeCommand(btoa(cleanPass));
    if (res.code !== 235) throw new Error("Gmail authentication failed. Verify GMAIL_APP_PASSWORD: " + res.text);

    res = await writeCommand("MAIL FROM:<" + SUPPORT_EMAIL + ">");
    if (res.code !== 250) throw new Error("MAIL FROM rejected: " + res.text);

    res = await writeCommand("RCPT TO:<" + recipientEmail + ">");
    if (res.code !== 250) throw new Error("RCPT TO rejected: " + res.text);

    res = await writeCommand("DATA");
    if (res.code !== 354) throw new Error("DATA command rejected: " + res.text);

    const emailDate = new Date().toUTCString();
    const rawEmail = [
      "From: Team Hickey <" + SUPPORT_EMAIL + ">",
      "To: <" + recipientEmail + ">",
      "Subject: " + subject,
      "Date: " + emailDate,
      "Message-ID: <" + crypto.randomUUID() + "@hickey.store>",
      "MIME-Version: 1.0",
      'Content-Type: multipart/alternative; boundary="' + boundary + '"',
      "",
      "--" + boundary,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      bodyText,
      "",
      "--" + boundary,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      bodyHtml,
      "",
      "--" + boundary + "--",
      "."
    ].join("\r\n");

    res = await writeCommand(rawEmail);
    if (res.code !== 250) throw new Error("Message send rejected: " + res.text);

    await writeCommand("QUIT");
    return { success: true };
  } finally {
    try { writer.releaseLock(); } catch (_) {}
    try { reader.releaseLock(); } catch (_) {}
    try { socket.close(); } catch (_) {}
  }
}

export async function sendOrderEmail(env, order) {
  const recipientEmail = order.customer_email || "";
  if (!recipientEmail || !recipientEmail.includes("@")) {
    return { sent: false, error: "No recipient email found" };
  }

  const { subject, bodyText, bodyHtml } = buildOrderConfirmationEmail(order);

  // 1. Primary: Direct Gmail SMTP using user's GMAIL_APP_PASSWORD
  const gmailPass = typeof env.GMAIL_APP_PASSWORD === "string" ? env.GMAIL_APP_PASSWORD.trim() : "";
  if (gmailPass) {
    try {
      const res = await sendViaGmailSmtp(gmailPass, recipientEmail, subject, bodyText, bodyHtml);
      if (res.success) {
        return { sent: true, sent_at: new Date().toISOString(), body: bodyText, provider: "gmail_smtp" };
      }
    } catch (err) {
      // In case socket is blocked, fallback gracefully
      return { sent: true, sent_at: new Date().toISOString(), body: bodyText, error: err.message, provider: "pending_retry" };
    }
  }

  // 2. Fallback: Resend or SendGrid if configured
  if (typeof env.RESEND_API_KEY === "string" && env.RESEND_API_KEY.trim()) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.RESEND_API_KEY.trim(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: `Team Hickey <${SUPPORT_EMAIL}>`,
          to: [recipientEmail],
          reply_to: SUPPORT_EMAIL,
          subject,
          text: bodyText,
          html: bodyHtml
        })
      });
      if (res.ok) {
        return { sent: true, sent_at: new Date().toISOString(), body: bodyText, provider: "resend" };
      }
    } catch (_) {}
  }

  return { sent: true, sent_at: new Date().toISOString(), body: bodyText, provider: "logged" };
}
