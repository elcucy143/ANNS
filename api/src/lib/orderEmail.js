const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'ANNS Orders <orders@annsonline.shop>';
const DEFAULT_ADMIN_EMAIL = 'astrendsandgifts@gmail.com';
const SITE_URL = 'https://www.annsonline.shop';
const CONTACT_URL = `${SITE_URL}/contact`;
const WHATSAPP_URL = 'https://wa.me/919849792562';

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

const addDays = (start, days) => {
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

const getDeliveryEstimate = (paidAt = new Date().toISOString()) => {
  const estimatedDate = addDays(paidAt, 7);
  return { start: estimatedDate, end: estimatedDate };
};

const absoluteProductImage = (value) => {
  const image = String(value || '').trim();
  if (/^https:\/\//i.test(image)) return image;
  if (image.startsWith('/')) return `${SITE_URL}${image}`;
  return '';
};

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

const orderRows = (order) => order.items.map((item) => {
  const imageUrl = absoluteProductImage(item.image);
  return `
  <tr>
    <td style="width:72px;padding:10px 12px 10px 0;border-bottom:1px solid #eee">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name)}" width="64" height="80" style="display:block;width:64px;height:80px;object-fit:cover;border-radius:6px;background:#f1ece8">` : ''}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eee">${escapeHtml(item.name)}<br><small>Product code: ${escapeHtml(item.id)}${[item.size, item.color].filter(Boolean).length ? ` · ${escapeHtml([item.size, item.color].filter(Boolean).join(' · '))}` : ''}${Number(item.bogoDiscount) > 0 ? ` · Buy 1 Get 1 saving ${escapeHtml(formatCurrency(item.bogoDiscount))}` : ''}</small></td>
    <td style="padding:10px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right">${escapeHtml(formatCurrency(item.lineTotal))}</td>
  </tr>`;
}).join('');

const offerTextLines = (order) => [
  ...(Number(order.firstOrderDiscount) > 0 ? [`First order discount (${order.couponCode || 'FIRST10'}): -${formatCurrency(order.firstOrderDiscount)}`] : []),
  ...(Number(order.cartDiscount) > 0 ? [`Shop ₹2,999 offer: -${formatCurrency(order.cartDiscount)}`] : []),
  ...(Number(order.shippingDiscount) > 0 ? [`Free shipping saving: -${formatCurrency(order.shippingDiscount)}`] : []),
];

const offerHtmlRows = (order) => [
  Number(order.firstOrderDiscount) > 0 ? `<tr><td colspan="3" style="padding-top:8px;color:#198754">First order discount (${escapeHtml(order.couponCode || 'FIRST10')})</td><td style="padding-top:8px;text-align:right;color:#198754">−${escapeHtml(formatCurrency(order.firstOrderDiscount))}</td></tr>` : '',
  Number(order.cartDiscount) > 0 ? `<tr><td colspan="3" style="padding-top:8px;color:#198754">Shop ₹2,999 offer</td><td style="padding-top:8px;text-align:right;color:#198754">−${escapeHtml(formatCurrency(order.cartDiscount))}</td></tr>` : '',
].join('');

const shippingLabel = (order) => Number(order.shippingTotal) > 0
  ? formatCurrency(order.shippingTotal)
  : Number(order.shippingDiscount) > 0
    ? `Free (saved ${formatCurrency(order.shippingDiscount)})`
    : 'Free';

const orderText = (order, estimate) => [
  `Thank you for shopping with ANNS, ${order.customer.name}.`,
  `Order: ${order.id}`,
  `Payment: Confirmed`,
  `Estimated delivery date: ${formatDate(estimate.end)}`,
  '',
  ...order.items.map((item) => `${item.quantity} × ${item.name} | Product code: ${item.id} | ${[item.size, item.color].filter(Boolean).join(', ') || 'Standard'} | ${formatCurrency(item.lineTotal)}`),
  '',
  `Merchandise: ${formatCurrency(order.merchandiseSubtotal ?? order.subtotal ?? order.total)}`,
  ...(Number(order.bogoDiscount) > 0 ? [`Buy 1 Get 1 savings: -${formatCurrency(order.bogoDiscount)}`] : []),
  `Subtotal: ${formatCurrency(order.subtotal ?? order.total)}`,
  ...offerTextLines(order),
  `Shipping: ${shippingLabel(order)}`,
  `Total: ${formatCurrency(order.total)}`,
  `Deliver to: ${[order.shippingAddress.addressLine1, order.shippingAddress.addressLine2, order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postalCode].filter(Boolean).join(', ')}`,
  '',
  `Questions? Visit ${CONTACT_URL} or WhatsApp us at ${WHATSAPP_URL}.`,
].join('\n');

const customerHtml = (order, estimate) => `<!doctype html><html><body style="margin:0;background:#f5f1ec;font-family:Arial,sans-serif;color:#29231f">
  <div style="max-width:640px;margin:auto;padding:28px 16px">
    <div style="background:#fff;padding:32px;border-radius:12px">
      <p style="letter-spacing:3px;color:#ad7046;font-weight:700">ANNS</p>
      <h1 style="font-family:Georgia,serif;font-weight:500">Your order is confirmed</h1>
      <p>Hi ${escapeHtml(order.customer.name)}, we received your payment and are preparing your order.</p>
      <div style="background:#f5f1ec;padding:16px;margin:24px 0"><strong>Order ${escapeHtml(order.id)}</strong><br>Estimated delivery date: <strong>${escapeHtml(formatDate(estimate.end))}</strong> (7 days from payment)</div>
      <table style="width:100%;border-collapse:collapse">${orderRows(order)}<tr><td colspan="3" style="padding-top:16px">Merchandise</td><td style="padding-top:16px;text-align:right">${escapeHtml(formatCurrency(order.merchandiseSubtotal ?? order.subtotal ?? order.total))}</td></tr>${Number(order.bogoDiscount) > 0 ? `<tr><td colspan="3" style="padding-top:8px;color:#198754">Buy 1 Get 1 savings</td><td style="padding-top:8px;text-align:right;color:#198754">−${escapeHtml(formatCurrency(order.bogoDiscount))}</td></tr>` : ''}${offerHtmlRows(order)}<tr><td colspan="3" style="padding-top:8px">Shipping</td><td style="padding-top:8px;text-align:right">${escapeHtml(shippingLabel(order))}</td></tr><tr><td colspan="3" style="padding-top:10px;font-weight:700">Total</td><td style="padding-top:10px;text-align:right;font-weight:700">${escapeHtml(formatCurrency(order.total))}</td></tr></table>
      <h3 style="margin-top:28px">Delivery address</h3>
      <p>${escapeHtml([order.shippingAddress.addressLine1, order.shippingAddress.addressLine2, order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postalCode].filter(Boolean).join(', '))}</p>
      <p style="margin-top:28px;color:#756d66">Need help with your order? Visit our <a href="${CONTACT_URL}" style="color:#8b5737">Contact Us page</a> or <a href="${WHATSAPP_URL}" style="color:#198754">message ANNS on WhatsApp</a>.</p>
    </div>
  </div></body></html>`;

const adminOrderRows = (order) => order.items.map((item) => {
  const productUrl = `${SITE_URL}/product/${encodeURIComponent(item.id)}`;
  const imageUrl = absoluteProductImage(item.image);
  return `<tr><td style="width:72px;padding:12px 12px 12px 0;border-bottom:1px solid #e9e4df">${imageUrl ? `<a href="${productUrl}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name)}" width="64" height="80" style="display:block;width:64px;height:80px;object-fit:cover;border-radius:6px;background:#f1ece8"></a>` : ''}</td><td style="padding:12px 0;border-bottom:1px solid #e9e4df"><a href="${productUrl}" style="color:#8b5737;font-weight:700">${escapeHtml(item.name)}</a><br><small>Product code: ${escapeHtml(item.id)} · ${escapeHtml([item.size, item.color].filter(Boolean).join(' · ') || 'Standard')}</small></td><td style="padding:12px;border-bottom:1px solid #e9e4df;text-align:center">${item.quantity}</td><td style="padding:12px 0;border-bottom:1px solid #e9e4df;text-align:right">${escapeHtml(formatCurrency(item.lineTotal))}</td></tr>`;
}).join('');

const adminOrderText = (order, estimate) => [
  'NEW PAID ORDER — ACTION REQUIRED',
  `Order: ${order.id}`,
  `Admin: ${SITE_URL}/product-manager?view=orders&order=${encodeURIComponent(order.id)}`,
  `Payment ID: ${order.razorpayPaymentId || 'Captured by Razorpay'}`,
  `Customer: ${order.customer.name} | ${order.customer.email} | ${order.customer.phone || ''}`,
  `Estimated delivery date: ${formatDate(estimate.end)} (7 days from payment)`,
  '',
  ...order.items.map((item) => `${item.quantity} × ${item.name} | Code: ${item.id} | ${[item.size, item.color].filter(Boolean).join(', ') || 'Standard'} | ${formatCurrency(item.lineTotal)} | ${SITE_URL}/product/${encodeURIComponent(item.id)}`),
  '',
  `Merchandise: ${formatCurrency(order.merchandiseSubtotal ?? order.subtotal ?? order.total)}`,
  ...(Number(order.bogoDiscount) > 0 ? [`Buy 1 Get 1 savings: -${formatCurrency(order.bogoDiscount)}`] : []),
  `Subtotal: ${formatCurrency(order.subtotal ?? order.total)}`,
  ...offerTextLines(order),
  `Shipping: ${shippingLabel(order)}`,
  `Total: ${formatCurrency(order.total)}`,
  `Ship to: ${[order.shippingAddress.addressLine1, order.shippingAddress.addressLine2, order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postalCode].filter(Boolean).join(', ')}`,
].join('\n');

const adminOrderHtml = (order, estimate) => {
  const adminUrl = `${SITE_URL}/product-manager?view=orders&order=${encodeURIComponent(order.id)}`;
  return `<!doctype html><html><body style="margin:0;background:#eee9e4;font-family:Arial,sans-serif;color:#29231f"><div style="max-width:680px;margin:auto;padding:28px 16px"><div style="background:#fff;padding:32px;border-radius:12px;border-top:5px solid #a66f49"><p style="letter-spacing:3px;color:#ad7046;font-weight:700">ANNS ADMIN ALERT</p><h1 style="font-family:Georgia,serif;font-weight:500">New paid order</h1><p>This is an internal fulfilment notification. Payment has been verified and captured.</p><div style="background:#f5f1ec;padding:18px;margin:22px 0"><strong>Order ${escapeHtml(order.id)}</strong><br>Payment: ${escapeHtml(order.razorpayPaymentId || 'Captured by Razorpay')}<br>Estimated delivery date: <strong>${escapeHtml(formatDate(estimate.end))}</strong> (7 days from payment)</div><h3>Customer</h3><p>${escapeHtml(order.customer.name)}<br><a href="mailto:${escapeHtml(order.customer.email)}">${escapeHtml(order.customer.email)}</a><br>${escapeHtml(order.customer.phone || '')}</p><table style="width:100%;border-collapse:collapse"><thead><tr><th></th><th style="text-align:left">Product / code</th><th>Qty</th><th style="text-align:right">Amount</th></tr></thead><tbody>${adminOrderRows(order)}${offerHtmlRows(order)}<tr><td colspan="3" style="padding-top:8px">Shipping</td><td style="padding-top:8px;text-align:right">${escapeHtml(shippingLabel(order))}</td></tr><tr><td colspan="3" style="padding-top:16px;font-weight:700">Total paid</td><td style="padding-top:16px;text-align:right;font-weight:700">${escapeHtml(formatCurrency(order.total))}</td></tr></tbody></table><h3 style="margin-top:26px">Delivery address</h3><p>${escapeHtml([order.shippingAddress.addressLine1, order.shippingAddress.addressLine2, order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postalCode].filter(Boolean).join(', '))}</p><p style="margin:28px 0 4px"><a href="${adminUrl}" style="display:inline-block;padding:14px 22px;background:#29231f;color:#fff;text-decoration:none;border-radius:5px">Open order in admin dashboard</a></p><p style="margin-top:20px;color:#756d66">Customer support: <a href="${CONTACT_URL}" style="color:#8b5737">Contact Us</a> · <a href="${WHATSAPP_URL}" style="color:#198754">WhatsApp</a></p></div></div></body></html>`;
};

const sendAdminOrderEmail = async (order, estimate) => sendEmail({
  to: process.env.ORDER_NOTIFICATION_EMAIL || DEFAULT_ADMIN_EMAIL,
  subject: `ADMIN: New paid order ${order.id} — ${order.items.map((item) => item.id).join(', ')}`,
  html: adminOrderHtml(order, estimate),
  text: adminOrderText(order, estimate),
});

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
      adminResult = await sendAdminOrderEmail(order, estimate);
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
  const packed = order.fulfillmentStatus === 'packed';
  const shipped = order.fulfillmentStatus === 'shipped';
  const outForDelivery = order.fulfillmentStatus === 'out_for_delivery';
  const delivered = order.fulfillmentStatus === 'delivered';
  const heading = delivered ? 'Your order has been delivered' : outForDelivery ? 'Your order is out for delivery' : shipped ? 'Your order is on its way' : packed ? 'Your order has been packed' : 'We are processing your order';
  const message = delivered ? 'your ANNS order has been marked as delivered.'
    : outForDelivery ? 'your ANNS order is with the courier and should reach you shortly.'
      : shipped ? 'your ANNS order has been shipped.'
        : packed ? 'your ANNS order is packed and will be handed to the courier soon.'
          : 'we are preparing your ANNS order.';
  const tracking = order.trackingNumber
    ? `<div style="background:#f5f1ec;padding:16px;margin:24px 0"><strong>${escapeHtml(order.courier || 'Courier')}</strong><br>Tracking number: ${escapeHtml(order.trackingNumber)}${order.trackingUrl ? `<br><a href="${escapeHtml(order.trackingUrl)}">Track your shipment</a>` : ''}</div>`
    : '';
  return sendEmail({
    to: order.customer.email,
    subject: `${heading} — ${order.id}`,
    html: `<!doctype html><html><body style="margin:0;background:#f5f1ec;font-family:Arial,sans-serif;color:#29231f"><div style="max-width:640px;margin:auto;padding:28px 16px"><div style="background:#fff;padding:32px;border-radius:12px"><p style="letter-spacing:3px;color:#ad7046;font-weight:700">ANNS</p><h1 style="font-family:Georgia,serif;font-weight:500">${heading}</h1><p>Hi ${escapeHtml(order.customer.name)}, ${message}</p><p><strong>Order ${escapeHtml(order.id)}</strong></p>${tracking}<p style="margin-top:20px">Current status: <strong>${escapeHtml(String(order.fulfillmentStatus || 'processing').replaceAll('_', ' '))}</strong></p><p style="margin-top:28px;color:#756d66">Need help? Visit our <a href="${CONTACT_URL}">Contact Us page</a> or <a href="${WHATSAPP_URL}">message ANNS on WhatsApp</a>.</p></div></div></body></html>`,
    text: [heading, `Order: ${order.id}`, `Status: ${String(order.fulfillmentStatus || 'processing').replaceAll('_', ' ')}`, order.courier ? `Courier: ${order.courier}` : '', order.trackingNumber ? `Tracking number: ${order.trackingNumber}` : '', order.trackingUrl ? `Track: ${order.trackingUrl}` : '', '', `Need help? ${CONTACT_URL} or ${WHATSAPP_URL}`].filter(Boolean).join('\n'),
  });
};

const sendPasswordResetEmail = async (customer, resetUrl) => sendEmail({
  to: customer.email,
  subject: 'Reset your ANNS password',
  html: `<!doctype html><html><body style="margin:0;background:#f5f1ec;font-family:Arial,sans-serif;color:#29231f"><div style="max-width:640px;margin:auto;padding:28px 16px"><div style="background:#fff;padding:32px;border-radius:12px"><p style="letter-spacing:3px;color:#ad7046;font-weight:700">ANNS</p><h1 style="font-family:Georgia,serif;font-weight:500">Reset your password</h1><p>Hi ${escapeHtml(customer.name || 'there')}, use the secure link below within 30 minutes.</p><p style="margin:28px 0"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:13px 22px;background:#29231f;color:#fff;text-decoration:none;border-radius:4px">Reset password</a></p><p style="color:#756d66">If you did not request this, you can safely ignore this email.</p></div></div></body></html>`,
  text: `Reset your ANNS password within 30 minutes: ${resetUrl}\n\nIf you did not request this, ignore this email.`,
});

const sendCancellationEmail = async (order, type) => {
  const isRequest = type === 'requested';
  const processed = type === 'processed';
  const failed = type === 'failed';
  const adminEmail = process.env.ORDER_NOTIFICATION_EMAIL || DEFAULT_ADMIN_EMAIL;
  return sendEmail({
    to: isRequest ? adminEmail : order.customer.email,
    subject: isRequest ? `Cancellation requested — ${order.id}` : failed ? `Refund needs attention — ${order.id}` : processed ? `Refund completed — ${order.id}` : `Refund initiated — ${order.id}`,
    html: `<!doctype html><html><body style="margin:0;background:#f5f1ec;font-family:Arial,sans-serif;color:#29231f"><div style="max-width:640px;margin:auto;padding:28px 16px"><div style="background:#fff;padding:32px;border-radius:12px"><p style="letter-spacing:3px;color:#ad7046;font-weight:700">ANNS</p><h1 style="font-family:Georgia,serif;font-weight:500">${isRequest ? 'Cancellation requested' : failed ? 'Your refund needs attention' : processed ? 'Your refund is complete' : 'Your refund has been initiated'}</h1><p>Order <strong>${escapeHtml(order.id)}</strong></p><p>${isRequest ? `Customer: ${escapeHtml(order.customer.name)} (${escapeHtml(order.customer.email)})<br>Reason: ${escapeHtml(order.cancellation?.reason || 'Not provided')}` : failed ? 'The payment provider could not complete this refund automatically. The ANNS team has been notified and will review it.' : processed ? `Razorpay confirmed your refund of ${escapeHtml(formatCurrency(order.total))}. Your bank may take several business days to display it.` : `We initiated a refund of ${escapeHtml(formatCurrency(order.total))}. Your bank may take several business days to show it.`}</p></div></div></body></html>`,
    text: isRequest ? `Cancellation requested\nOrder: ${order.id}\nCustomer: ${order.customer.name}\nReason: ${order.cancellation?.reason || 'Not provided'}` : `${failed ? 'Refund needs attention' : processed ? 'Refund completed' : 'Refund initiated'}\nOrder: ${order.id}\nAmount: ${formatCurrency(order.total)}`,
  });
};

const sendRefundAdminEmail = async (order, type) => sendEmail({
  to: process.env.ORDER_NOTIFICATION_EMAIL || DEFAULT_ADMIN_EMAIL,
  subject: `${type === 'failed' ? 'Refund failed' : type === 'processed' ? 'Refund completed' : 'Refund initiated'} — ${order.id}`,
  html: `<!doctype html><html><body style="font-family:Arial,sans-serif"><h1>Refund ${escapeHtml(type)}</h1><p>Order <strong>${escapeHtml(order.id)}</strong></p><p>Customer: ${escapeHtml(order.customer.name)} (${escapeHtml(order.customer.email)})</p><p>Amount: ${escapeHtml(formatCurrency(order.total))}</p><p>Razorpay refund: ${escapeHtml(order.razorpayRefundId || 'Check Razorpay dashboard')}</p></body></html>`,
  text: `Refund ${type}\nOrder: ${order.id}\nCustomer: ${order.customer.name}\nAmount: ${formatCurrency(order.total)}\nRazorpay refund: ${order.razorpayRefundId || 'Check Razorpay dashboard'}`,
});

module.exports = {
  getDeliveryEstimate, sendAdminOrderEmail, sendCancellationEmail, sendContactMessage, sendFulfillmentUpdateEmail, sendOrderEmails, sendPasswordResetEmail, sendRefundAdminEmail, sendWelcomeEmail,
};
