const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'ANNS Orders <orders@annsonline.shop>';
const DEFAULT_ADMIN_EMAIL = 'astrendsandgifts@gmail.com';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatCurrency = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(Number(value) || 0);

const formatDate = (value) => new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
}).format(new Date(value));

const addBusinessDays = (start, days) => {
  const date = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) remaining -= 1;
  }
  return date.toISOString();
};

const getDeliveryEstimate = (paidAt = new Date().toISOString()) => ({
  start: addBusinessDays(paidAt, 5),
  end: addBusinessDays(paidAt, 7),
});

const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.ORDER_EMAIL_FROM || DEFAULT_FROM,
      to: [to],
      reply_to: replyTo || process.env.ORDER_REPLY_TO || DEFAULT_ADMIN_EMAIL,
      subject,
      html,
      text,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || 'Resend rejected the email');
    error.status = response.status;
    throw error;
  }
  return result;
};

const sendContactMessage = async ({ name, email, message }) => {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replaceAll('\n', '<br>');
  const adminEmail = process.env.CONTACT_NOTIFICATION_EMAIL
    || process.env.ORDER_NOTIFICATION_EMAIL
    || DEFAULT_ADMIN_EMAIL;
  return sendEmail({
    to: adminEmail,
    replyTo: email,
    subject: `New website message from ${name}`,
    html: `<!doctype html><html><body style="margin:0;background:#f5f1ec;font-family:Arial,sans-serif;color:#29231f">
      <div style="max-width:640px;margin:auto;padding:28px 16px"><div style="background:#fff;padding:32px;border-radius:12px">
        <p style="letter-spacing:3px;color:#ad7046;font-weight:700">ANNS</p>
        <h1 style="font-family:Georgia,serif;font-weight:500">New contact message</h1>
        <p><strong>From:</strong> ${safeName}</p><p><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
        <div style="background:#f5f1ec;padding:18px;margin-top:24px;line-height:1.6">${safeMessage}</div>
        <p style="color:#756d66;margin-top:24px">Reply directly to this email to answer the customer.</p>
      </div></div></body></html>`,
    text: `New ANNS website message\n\nFrom: ${name}\nEmail: ${email}\n\n${message}`,
  });
};

const orderRows = (order) => order.items.map((item) => `
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #eee">${escapeHtml(item.name)}<br><small>${escapeHtml([item.size, item.color].filter(Boolean).join(' · '))}</small></td>
    <td style="padding:10px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right">${escapeHtml(formatCurrency(item.lineTotal))}</td>
  </tr>`).join('');

const orderText = (order, estimate) => [
  `Thank you for shopping with ANNS, ${order.customer.name}.`,
  `Order: ${order.id}`,
  `Payment: Confirmed`,
  `Estimated delivery: ${formatDate(estimate.start)} – ${formatDate(estimate.end)}`,
  '',
  ...order.items.map((item) => `${item.quantity} × ${item.name} (${[item.size, item.color].filter(Boolean).join(', ')}) — ${formatCurrency(item.lineTotal)}`),
  '',
  `Total: ${formatCurrency(order.total)}`,
  `Deliver to: ${[order.shippingAddress.addressLine1, order.shippingAddress.addressLine2, order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postalCode].filter(Boolean).join(', ')}`,
  '',
  'Questions? Reply to this email or WhatsApp +91 98497 92562.',
].join('\n');

const customerHtml = (order, estimate) => `<!doctype html><html><body style="margin:0;background:#f5f1ec;font-family:Arial,sans-serif;color:#29231f">
  <div style="max-width:640px;margin:auto;padding:28px 16px">
    <div style="background:#fff;padding:32px;border-radius:12px">
      <p style="letter-spacing:3px;color:#ad7046;font-weight:700">ANNS</p>
      <h1 style="font-family:Georgia,serif;font-weight:500">Your order is confirmed</h1>
      <p>Hi ${escapeHtml(order.customer.name)}, we received your payment and are preparing your order.</p>
      <div style="background:#f5f1ec;padding:16px;margin:24px 0"><strong>Order ${escapeHtml(order.id)}</strong><br>Estimated delivery: ${escapeHtml(formatDate(estimate.start))} – ${escapeHtml(formatDate(estimate.end))}</div>
      <table style="width:100%;border-collapse:collapse">${orderRows(order)}<tr><td colspan="2" style="padding-top:16px;font-weight:700">Total</td><td style="padding-top:16px;text-align:right;font-weight:700">${escapeHtml(formatCurrency(order.total))}</td></tr></table>
      <h3 style="margin-top:28px">Delivery address</h3>
      <p>${escapeHtml([order.shippingAddress.addressLine1, order.shippingAddress.addressLine2, order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postalCode].filter(Boolean).join(', '))}</p>
      <p style="margin-top:28px;color:#756d66">Need help? Reply to this email or WhatsApp +91 98497 92562.</p>
    </div>
  </div></body></html>`;

const sendOrderEmails = async (order, estimate) => {
  const customerResult = await sendEmail({
    to: order.customer.email,
    subject: `Order confirmed — ${order.id}`,
    html: customerHtml(order, estimate),
    text: orderText(order, estimate),
  });

  const adminEmail = process.env.ORDER_NOTIFICATION_EMAIL || DEFAULT_ADMIN_EMAIL;
  let adminResult = null;
  let adminEmailError = null;
  if (adminEmail && adminEmail.toLowerCase() !== order.customer.email.toLowerCase()) {
    try {
      adminResult = await sendEmail({
        to: adminEmail,
        subject: `New paid order — ${order.id}`,
        html: customerHtml(order, estimate),
        text: orderText(order, estimate),
      });
    } catch (error) {
      // The customer receipt has already succeeded. Do not retry it and risk a
      // duplicate merely because the internal notification was rejected.
      adminEmailError = String(error.message || 'Admin notification failed').slice(0, 300);
    }
  }
  return { customerEmailId: customerResult.id, adminEmailId: adminResult?.id || null, adminEmailError };
};

const sendWelcomeEmail = async (customer) => {
  const name = escapeHtml(customer.name || 'there');
  const html = `<!doctype html><html><body style="margin:0;background:#f5f1ec;font-family:Arial,sans-serif;color:#29231f">
    <div style="max-width:640px;margin:auto;padding:28px 16px">
      <div style="background:#fff;padding:36px;border-radius:12px">
        <p style="letter-spacing:3px;color:#ad7046;font-weight:700">ANNS</p>
        <h1 style="font-family:Georgia,serif;font-weight:500">Welcome to ANNS</h1>
        <p>Hi ${name}, thank you for registering with ANNS.</p>
        <p>Your account is ready. You can now keep your cart through sign-in, check out securely and receive order and delivery updates.</p>
        <p style="margin:28px 0"><a href="https://www.annsonline.shop" style="display:inline-block;padding:13px 22px;background:#29231f;color:#fff;text-decoration:none;border-radius:4px">Start shopping</a></p>
        <p style="color:#756d66">Need help? Reply to this email or WhatsApp +91 98497 92562.</p>
      </div>
    </div></body></html>`;
  const text = [
    `Hi ${customer.name || 'there'},`,
    '',
    'Thank you for registering with ANNS. Your account is ready.',
    'Shop securely at https://www.annsonline.shop',
    '',
    'Need help? Reply to this email or WhatsApp +91 98497 92562.',
  ].join('\n');
  return sendEmail({
    to: customer.email,
    subject: 'Welcome to ANNS — your account is ready',
    html,
    text,
  });
};

const sendFulfillmentUpdateEmail = async (order) => {
  const shipped = order.fulfillmentStatus === 'shipped';
  const delivered = order.fulfillmentStatus === 'delivered';
  const heading = delivered ? 'Your order has been delivered' : 'Your order is on its way';
  const tracking = shipped && order.trackingNumber
    ? `<div style="background:#f5f1ec;padding:16px;margin:24px 0"><strong>${escapeHtml(order.courier || 'Courier')}</strong><br>Tracking number: ${escapeHtml(order.trackingNumber)}${order.trackingUrl ? `<br><a href="${escapeHtml(order.trackingUrl)}">Track your shipment</a>` : ''}</div>`
    : '';
  return sendEmail({
    to: order.customer.email,
    subject: `${heading} — ${order.id}`,
    html: `<!doctype html><html><body style="margin:0;background:#f5f1ec;font-family:Arial,sans-serif;color:#29231f"><div style="max-width:640px;margin:auto;padding:28px 16px"><div style="background:#fff;padding:32px;border-radius:12px"><p style="letter-spacing:3px;color:#ad7046;font-weight:700">ANNS</p><h1 style="font-family:Georgia,serif;font-weight:500">${heading}</h1><p>Hi ${escapeHtml(order.customer.name)}, ${delivered ? 'your ANNS order has been marked as delivered.' : 'your ANNS order has been shipped.'}</p><p><strong>Order ${escapeHtml(order.id)}</strong></p>${tracking}<p style="margin-top:28px;color:#756d66">Need help? Reply to this email or WhatsApp +91 98497 92562.</p></div></div></body></html>`,
    text: [heading, `Order: ${order.id}`, shipped && order.courier ? `Courier: ${order.courier}` : '', shipped && order.trackingNumber ? `Tracking number: ${order.trackingNumber}` : '', shipped && order.trackingUrl ? `Track: ${order.trackingUrl}` : '', '', 'Need help? Reply to this email or WhatsApp +91 98497 92562.'].filter(Boolean).join('\n'),
  });
};

module.exports = {
  getDeliveryEstimate, sendContactMessage, sendFulfillmentUpdateEmail, sendOrderEmails, sendWelcomeEmail,
};
