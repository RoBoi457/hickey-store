export const SUPPORT_EMAIL = "support.hickey@gmail.com";

export function buildOrderConfirmationEmail(order) {
  const name = order.customer_name && order.customer_name.trim() ? order.customer_name.trim() : "there";
  const id = order.order_ref || order.id || "";
  const supportContacts = "Prabhu: +91 89564 42297 | Chaitanya: +91 87073 12125 | Rohan: +91 86608 50435 | Naman Navlani: +91 87707 94490 | Harjaap: +91 70153 38429 | support.hickey@gmail.com";

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

export async function sendOrderEmail(env, order) {
  const recipientEmail = order?.customer_email || "";
  if (!recipientEmail || !recipientEmail.includes("@")) {
    return { sent: false, error: "No recipient email found" };
  }

  const { subject, bodyText, bodyHtml } = buildOrderConfirmationEmail(order);

  const resendKey = typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.trim() : "";
  if (!resendKey) {
    return { sent: false, error: "RESEND_API_KEY is not configured" };
  }

  const fromAddress = (typeof env.RESEND_FROM_EMAIL === "string" && env.RESEND_FROM_EMAIL.trim())
    ? env.RESEND_FROM_EMAIL.trim()
    : `Team Hickey <support@gethickey.in>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + resendKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [recipientEmail],
        reply_to: SUPPORT_EMAIL,
        subject,
        text: bodyText,
        html: bodyHtml
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.id) {
      return { sent: true, sent_at: new Date().toISOString(), body: bodyText, provider: "resend", id: data.id };
    }
    return { sent: false, error: data?.message || ("Resend HTTP " + res.status) };
  } catch (err) {
    return { sent: false, error: err?.message || "Resend request failed" };
  }
}
