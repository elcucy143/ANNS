const { app } = require('@azure/functions');
const crypto = require('node:crypto');
const sharp = require('sharp');
const { getClient, getDb } = require('../lib/db');
const { handleError, isAdminKeyRequest, json, parseJson, requireAdmin } = require('../lib/http');
const {
  authenticateRequest,
  hashPassword,
  signAdminSession,
  signSession,
  verifyFirebaseCredential,
  verifyGoogleCredential,
  verifyPassword,
} = require('../lib/auth');
const { assertProductionConfig, configurationProblems } = require('../lib/config');
const {
  getDeliveryEstimate, sendAdminOrderEmail, sendCancellationEmail, sendContactMessage, sendFulfillmentUpdateEmail, sendOrderEmails, sendPasswordResetEmail, sendRefundAdminEmail, sendWelcomeEmail,
} = require('../lib/orderEmail');
const {
  captureRazorpayPayment,
  createRazorpayOrder,
  getCredentials,
  getRazorpayPayment,
  getRazorpayOrderPayments,
  refundRazorpayPayment,
  verifyPaymentSignature,
  verifyWebhookSignature,
} = require('../lib/razorpay');

assertProductionConfig();

const cleanDocument = (document) => {
  const cleaned = { ...document };
  delete cleaned._id;
  return cleaned;
};
const cleanCustomerDocument = (document) => {
  if (!document) return null;
  return {
    id: document.id,
    name: document.name || '',
    email: document.email || '',
    phone: document.phone || '',
    picture: document.picture || '',
    provider: document.provider || '',
  };
};
const nowIso = () => new Date().toISOString();
const cleanText = (value, maxLength = 200) => String(value || '').trim().slice(0, maxLength);
const normalizeProductId = (value) => cleanText(value, 100);
const numericPrice = (value) => Number(String(value ?? '').replace(/[^0-9.]/g, ''));
const standardSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const normalizeList = (value) => {
  if (Array.isArray(value)) return value.flatMap(normalizeList);
  if (value === undefined || value === null || value === '') return [];
  const text = String(value).trim();
  if (text.startsWith('data:image/')) return [text];
  return text.split(/[,|;\n]/).map((item) => item.trim()).filter(Boolean);
};
const normalizeSizes = (value) => {
  const sizes = normalizeList(value).flatMap((item) => item.match(/4XL|XXXXL|3XL|XXXL|XXL|XL|XS|S|M|L/gi) || [item])
    .map((size) => String(size).trim().toUpperCase().replace(/^XXXL$/, '3XL').replace(/^XXXXL$/, '4XL'));
  return [...new Set(sizes.filter(Boolean))].sort((first, second) => {
    const firstIndex = standardSizes.indexOf(first);
    const secondIndex = standardSizes.indexOf(second);
    return (firstIndex === -1 ? 99 : firstIndex) - (secondIndex === -1 ? 99 : secondIndex);
  });
};
const nonNegativeInteger = (value) => Math.max(0, Math.trunc(Number(value) || 0));
const normalizeReviewImage = (value) => {
  const image = String(value || '').trim();
  if (!image) return '';
  if (image.startsWith('data:image/') && image.length <= 700000) return image;
  if (/^https:\/\//i.test(image) && image.length <= 2000) return image;
  if (/^\/api\/media-image\?/i.test(image) && image.length <= 2000) return image;
  return '';
};
const normalizeBannerImage = (value) => {
  const image = String(value || '').trim();
  if (!image) return '';
  // The browser normally compresses banners below 450 KB, but base64 and
  // unusual WhatsApp wrappers can be larger. Keep the request below the API's
  // 4 MB limit, then externalize the bytes before storing the sale document.
  if (image.startsWith('data:image/') && image.length <= 3 * 1024 * 1024) return image;
  if (/^https:\/\//i.test(image) && image.length <= 2000) return image;
  if (/^\/api\/media-image\?/i.test(image) && image.length <= 2000) return image;
  return '';
};
const normalizeReview = (review = {}) => ({
  id: cleanText(review.id, 100) || `review-${crypto.randomUUID()}`,
  reviewerName: cleanText(review.reviewerName, 120),
  rating: Math.max(1, Math.min(5, nonNegativeInteger(review.rating) || 5)),
  title: cleanText(review.title, 160),
  comment: cleanText(review.comment, 1500),
  image: normalizeReviewImage(review.image),
  productId: cleanText(review.productId, 100),
  reviewDate: cleanText(review.reviewDate, 30) || nowIso().slice(0, 10),
  featured: review.featured === true,
  published: review.published !== false,
  source: 'customer',
});
const normalizeFlashSale = (sale = {}) => ({
  id: 'homepage',
  title: cleanText(sale.title, 120) || 'Flash Sale',
  subtitle: cleanText(sale.subtitle, 240),
  badge: cleanText(sale.badge, 40) || 'LIMITED TIME',
  bannerImage: normalizeBannerImage(sale.bannerImage),
  startsAt: cleanText(sale.startsAt, 30),
  endsAt: cleanText(sale.endsAt, 30),
  active: sale.active === true,
  items: (Array.isArray(sale.items) ? sale.items : []).slice(0, 24).map((item) => ({
    productId: cleanText(item.productId, 100),
    salePrice: Number(numericPrice(item.salePrice).toFixed(2)),
  })).filter((item) => item.productId && Number.isFinite(item.salePrice) && item.salePrice > 0),
});
const isFlashSaleActive = (sale, at = new Date()) => {
  if (!sale?.active) return false;
  const startsAt = sale.startsAt ? new Date(sale.startsAt) : null;
  const endsAt = sale.endsAt ? new Date(sale.endsAt) : null;
  if (startsAt && !Number.isNaN(startsAt.getTime()) && at < startsAt) return false;
  if (endsAt && !Number.isNaN(endsAt.getTime()) && at > endsAt) return false;
  return true;
};
const normalizeProduct = (product) => {
  const stock = nonNegativeInteger(product.stock ?? product.totalStock ?? product.quantity);
  const sold = Math.min(stock, nonNegativeInteger(product.sold ?? product.unitsSold));
  return {
    // Persist only catalog fields. Products loaded for editing also contain
    // database metadata (createdAt/updatedAt); passing that metadata back into
    // both $set and $setOnInsert makes MongoDB reject an otherwise valid edit.
    id: normalizeProductId(product.id),
    name: cleanText(product.name, 200),
    description: cleanText(product.description, 10000),
    price: cleanText(product.price, 50),
    discount: cleanText(product.discount, 50),
    image: cleanText(product.image, 4 * 1024 * 1024),
    otherImages: normalizeList(product.otherImages).slice(0, 4),
    color: cleanText(product.color, 100),
    stock,
    sold,
    sizes: normalizeSizes(product.sizes ?? product.size),
    subcategory: normalizeList(product.subcategory),
    similarProducts: normalizeList(product.similarProducts).map(normalizeProductId).filter(Boolean),
    reviews: normalizeList(product.reviews),
    shipping: normalizeList(product.shipping),
    featured: product.featured === true || String(product.featured).toLowerCase() === 'yes' ? 'yes' : 'no',
    campaign: normalizeList(product.campaign),
    showOnCategory: product.showOnCategory !== false,
    category: cleanText(product.category, 100),
    available: stock > sold ? 'In Stock' : 'Out of Stock',
  };
};
const dataImagePattern = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\r\n]+)$/i;
const productImageUrl = (productId, index, version) => `/api/product-image?id=${encodeURIComponent(productId)}&index=${index}&v=${version}`;
const mediaImageUrl = (key, version) => `/api/media-image?key=${encodeURIComponent(key)}&v=${version}`;
const externalizeMediaImage = async (db, key, value, operationTime = nowIso()) => {
  const image = String(value || '').trim();
  const match = image.match(dataImagePattern);
  if (!match) return image;
  const data = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  const version = crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
  await db.collection('mediaImages').updateOne(
    { key },
    { $set: { key, contentType: match[1].toLowerCase(), data, version, updatedAt: operationTime }, $setOnInsert: { createdAt: operationTime } },
    { upsert: true },
  );
  return mediaImageUrl(key, version);
};
const externalizeReviewImage = async (db, review, operationTime = nowIso()) => {
  const normalized = { ...review };
  const key = `review-${cleanText(normalized.id, 100)}`;
  normalized.image = await externalizeMediaImage(db, key, normalized.image, operationTime);
  return normalized;
};
const externalizeProductImages = async (db, rawProduct, operationTime = nowIso()) => {
  const product = { ...rawProduct };
  const productId = cleanText(product.id, 100);
  if (!productId) return product;
  const values = [product.image, ...normalizeList(product.otherImages)].slice(0, 5);
  const storedValues = [];
  const imageOperations = [];

  for (const [index, value] of values.entries()) {
    const image = String(value || '').trim();
    const match = image.match(dataImagePattern);
    if (!match) {
      storedValues.push(image);
      continue;
    }
    const data = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    const version = crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
    const optimized = sharp(data, { failOn: 'none', limitInputPixels: 80_000_000 }).rotate();
    const [thumbnail, listing] = await Promise.all([
      optimized.clone().resize({ width: 320, height: 420, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
      optimized.clone().resize({ width: 900, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer(),
    ]);
    imageOperations.push({
      updateOne: {
        filter: { productId, index },
        update: { $set: { productId, index, contentType: match[1].toLowerCase(), data, version, variants: { thumbnail, listing }, updatedAt: operationTime }, $setOnInsert: { createdAt: operationTime } },
        upsert: true,
      },
    });
    storedValues.push(productImageUrl(productId, index, version));
  }

  if (imageOperations.length) await db.collection('productImages').bulkWrite(imageOperations, {
    ordered: false,
    writeConcern: { w: 'majority', wtimeoutMS: 10000 },
  });
  await db.collection('productImages').deleteMany({ productId, index: { $gte: storedValues.length } });
  product.image = storedValues[0] || '';
  product.otherImages = storedValues.slice(1).filter(Boolean);
  return product;
};
const recordAdminAudit = async (db, request, action, target = '', details = {}) => {
  const forwarded = String(request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  await db.collection('adminAuditLogs').insertOne({
    id: crypto.randomUUID(), action, target: cleanText(target, 200), details,
    ipHash: forwarded ? crypto.createHash('sha256').update(forwarded).digest('hex').slice(0, 16) : '',
    createdAt: nowIso(),
  });
};
const registeredRoutes = [];
const registerHttp = (name, config) => {
  registeredRoutes.push({ name, ...config });
  app.http(name, config);
};

const paymentError = (context, error) => {
  context.error(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  const message = status === 502 ? 'Payment service rejected the request' : error.message || 'Payment request failed';
  return json({ error: message }, status);
};

const getActiveCustomer = async (db, session) => {
  if (!session?.sub || session.sub === 'admin') return null;
  return db.collection('customers').findOne({ id: session.sub, sessionActive: true });
};

const sendWelcomeEmailOnce = async (db, customer, context) => {
  if (!customer?.id || !customer.email || !process.env.RESEND_API_KEY) return;
  const token = crypto.randomUUID();
  const attemptedAt = nowIso();
  const claim = await db.collection('customers').updateOne(
    { id: customer.id, 'welcomeEmail.status': { $nin: ['sending', 'sent'] } },
    { $set: { welcomeEmail: { status: 'sending', token, attemptedAt }, updatedAt: attemptedAt } },
  );
  if (claim.modifiedCount !== 1) return;
  try {
    const result = await sendWelcomeEmail(customer);
    await db.collection('customers').updateOne(
      { id: customer.id, 'welcomeEmail.token': token },
      { $set: { welcomeEmail: { status: 'sent', emailId: result.id, sentAt: nowIso() }, updatedAt: nowIso() } },
    );
  } catch (error) {
    context.error('[welcome-email]', error);
    await db.collection('customers').updateOne(
      { id: customer.id, 'welcomeEmail.token': token },
      { $set: { welcomeEmail: { status: 'failed', error: cleanText(error.message, 300), attemptedAt }, updatedAt: nowIso() } },
    );
  }
};

const finalizeCapturedOrder = async (db, order, payment) => {
  const orders = db.collection('orders');
  const client = await getClient();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const currentOrder = await orders.findOne({ id: order.id }, { session });
      if (currentOrder?.paymentStatus === 'captured') return;

      for (const item of order.items) {
        const inventoryUpdate = await db.collection('products').updateOne(
          {
            id: item.id,
            $expr: {
              $gte: [
                { $subtract: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$sold', 0] }] },
                item.quantity,
              ],
            },
          },
          { $inc: { sold: item.quantity }, $set: { updatedAt: nowIso() } },
          { session },
        );
        if (inventoryUpdate.modifiedCount !== 1) {
          const inventoryError = new Error(`Inventory changed for ${item.name}`);
          inventoryError.code = 'INVENTORY_CONFLICT';
          throw inventoryError;
        }
      }

      await orders.updateOne(
        { id: order.id, paymentStatus: { $ne: 'captured' } },
        {
          $set: {
            razorpayPaymentId: payment.id,
            paymentStatus: 'captured',
            inventoryStatus: 'committed',
            status: 'Paid',
            paidAt: nowIso(),
            updatedAt: nowIso(),
          },
        },
        { session },
      );

    });
  } catch (error) {
    if (error.code !== 'INVENTORY_CONFLICT') throw error;
    await orders.updateOne(
      { id: order.id },
      {
        $set: {
          razorpayPaymentId: payment.id,
          paymentStatus: 'captured',
          inventoryStatus: 'review_required',
          status: 'Paid — inventory review required',
          paidAt: nowIso(),
          updatedAt: nowIso(),
        },
      },
    );
  } finally {
    await session.endSession();
  }

  // A checkout attempt is not a customer or sale until Razorpay confirms
  // capture. This keeps cancelled/failed attempts out of the dashboard.
  await db.collection('customers').updateOne(
    { id: order.customerId },
    {
      $set: {
        id: order.customerId,
        ...order.customer,
        provider: order.checkoutMode === 'guest' ? 'guest' : 'account',
        sessionActive: order.checkoutMode !== 'guest',
        lastSeenAt: nowIso(),
        updatedAt: nowIso(),
      },
      $setOnInsert: { createdAt: nowIso() },
    },
    { upsert: true },
  );

  return orders.findOne({ id: order.id });
};

const sendCapturedOrderConfirmation = async (db, order, context) => {
  if (!order || order.paymentStatus !== 'captured' || !process.env.RESEND_API_KEY) return order;
  const token = crypto.randomUUID();
  const claimedAt = nowIso();
  const claim = await db.collection('orders').updateOne(
    {
      id: order.id,
      paymentStatus: 'captured',
      'confirmationEmail.status': { $nin: ['sending', 'sent'] },
    },
    {
      $set: {
        confirmationEmail: { status: 'sending', token, attemptedAt: claimedAt },
        updatedAt: claimedAt,
      },
    },
  );
  if (claim.modifiedCount !== 1) return order;

  const estimate = order.deliveryEstimate || getDeliveryEstimate(order.paidAt || claimedAt);
  try {
    const result = await sendOrderEmails(order, estimate);
    await db.collection('orders').updateOne(
      { id: order.id, 'confirmationEmail.token': token },
      {
        $set: {
          deliveryEstimate: estimate,
          confirmationEmail: { status: 'sent', ...result, sentAt: nowIso() },
          adminPurchaseEmail: result.adminEmailError
            ? { status: 'failed', error: result.adminEmailError, attemptedAt: nowIso() }
            : { status: 'sent', emailId: result.adminEmailId, sentAt: nowIso() },
          updatedAt: nowIso(),
        },
      },
    );
    return db.collection('orders').findOne({ id: order.id });
  } catch (error) {
    context.error('Order confirmation email failed', error);
    await db.collection('orders').updateOne(
      { id: order.id, 'confirmationEmail.token': token },
      {
        $set: {
          deliveryEstimate: estimate,
          confirmationEmail: { status: 'failed', error: cleanText(error.message, 300), attemptedAt: claimedAt },
          updatedAt: nowIso(),
        },
      },
    );
    return db.collection('orders').findOne({ id: order.id });
  }
};

const sendRefundNotifications = async (db, order, type, context) => {
  if (!order?.id || !process.env.RESEND_API_KEY) return order;
  const field = type === 'requested' ? 'cancellationNotification' : `refundNotifications.${type}`;
  const attemptedAt = nowIso();
  const token = crypto.randomUUID();
  const claim = await db.collection('orders').updateOne(
    { id: order.id, [`${field}.status`]: { $nin: ['sending', 'sent'] } },
    { $set: { [field]: { status: 'sending', token, attemptedAt }, updatedAt: attemptedAt } },
  );
  if (claim.modifiedCount !== 1) return db.collection('orders').findOne({ id: order.id });
  try {
    const customerOrAdmin = await sendCancellationEmail(order, type);
    let admin = null;
    if (type !== 'requested') admin = await sendRefundAdminEmail(order, type);
    await db.collection('orders').updateOne(
      { id: order.id, [`${field}.token`]: token },
      { $set: { [field]: { status: 'sent', emailId: customerOrAdmin.id, adminEmailId: admin?.id || null, sentAt: nowIso() }, updatedAt: nowIso() } },
    );
  } catch (error) {
    context.error(`[${type}-email]`, error);
    await db.collection('orders').updateOne(
      { id: order.id, [`${field}.token`]: token },
      { $set: { [field]: { status: 'failed', error: cleanText(error.message, 300), attemptedAt }, updatedAt: nowIso() } },
    );
  }
  return db.collection('orders').findOne({ id: order.id });
};
const cronAuthorized = (request) => {
  const supplied = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const expected = String(process.env.CRON_SECRET || '');
  return Boolean(supplied && expected && supplied.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)));
};

registerHttp('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async (_request, context) => {
    try {
      const db = await getDb();
      await db.command({ ping: 1 });
      return json({ ok: true, database: process.env.MONGODB_DB_NAME || 'anns' });
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('readiness', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'readiness',
  handler: async (request, context) => {
    if (!isAdminKeyRequest(request)) {
      const unauthorized = requireAdmin(request);
      if (unauthorized) return unauthorized;
    }
    const problems = configurationProblems();
    try {
      const db = await getDb();
      await db.command({ ping: 1 });
      return json({ ready: problems.length === 0, database: true, missing: problems }, problems.length ? 503 : 200);
    } catch (error) {
      context.error(error);
      return json({ ready: false, database: false, missing: problems }, 503);
    }
  },
});

registerHttp('contact-message', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'contact',
  handler: async (request, context) => {
    try {
      const body = await parseJson(request);
      // This hidden field catches basic form bots without revealing the filter.
      if (cleanText(body?.website, 200)) return json({ ok: true });
      const name = cleanText(body?.name, 120).replace(/\s+/g, ' ');
      const email = cleanText(body?.email, 254).toLowerCase();
      const message = cleanText(body?.message, 3000);
      if (name.length < 2) return json({ error: 'Please enter your name' }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Please enter a valid email address' }, 400);
      if (message.length < 3) return json({ error: 'Please enter a message' }, 400);
      await sendContactMessage({ name, email, message });
      return json({ ok: true });
    } catch (error) {
      context.error('[contact-message]', error);
      return json({ error: 'We could not send your message. Please try again or contact us on WhatsApp.' }, 502);
    }
  },
});

registerHttp('google-auth', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/google',
  handler: async (request, context) => {
    try {
      const body = await parseJson(request);
      const user = await verifyGoogleCredential(body?.credential);
      user.normalizedEmail = user.email.toLowerCase();
      const operationTime = nowIso();
      const db = await getDb();
      const existingCustomer = await db.collection('customers').findOne({ id: user.id });
      await db.collection('customers').updateOne(
        { id: user.id },
        {
          $set: { ...user, sessionActive: true, lastSeenAt: operationTime, updatedAt: operationTime },
          $setOnInsert: { createdAt: operationTime },
        },
        { upsert: true },
      );
      if (!existingCustomer) await sendWelcomeEmailOnce(db, user, context);
      return json({ user, token: signSession(user) });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 401;
      if (status >= 500) context.error(error);
      return json({ error: status === 503 ? error.message : 'Google authentication failed' }, status);
    }
  },
});

registerHttp('credential-register', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/register',
  handler: async (request, context) => {
    try {
      const body = await parseJson(request);
      const name = cleanText(body?.name, 120);
      const phone = cleanText(body?.phone, 30).replace(/\s+/g, '');
      const email = cleanText(body?.email, 254).toLowerCase();
      const password = String(body?.password || '');
      if (name.length < 2) return json({ error: 'Enter your full name' }, 400);
      if (!/^\+?[0-9]{10,15}$/.test(phone)) return json({ error: 'Enter a valid mobile number' }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address' }, 400);
      if (password.length < 10 || password.length > 128 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return json({ error: 'Password must be 10 to 128 characters and include a letter and number' }, 400);
      }

      const db = await getDb();
      const customers = db.collection('customers');
      if (await customers.findOne({ normalizedEmail: email })) {
        return json({ error: 'An account already exists for this email' }, 409);
      }
      const operationTime = nowIso();
      const user = {
        id: `credentials:${crypto.createHash('sha256').update(email).digest('hex').slice(0, 32)}`,
        name,
        email,
        normalizedEmail: email,
        phone,
        picture: '',
        provider: 'credentials',
      };
      await customers.insertOne({
        ...user,
        passwordHash: await hashPassword(password),
        sessionActive: true,
        createdAt: operationTime,
        lastSeenAt: operationTime,
        updatedAt: operationTime,
      });
      await sendWelcomeEmailOnce(db, user, context);
      const publicUser = cleanCustomerDocument(user);
      return json({ user: publicUser, token: signSession(publicUser) }, 201);
    } catch (error) {
      if (error?.code === 11000) return json({ error: 'An account already exists for this email' }, 409);
      return handleError(context, error);
    }
  },
});

registerHttp('credential-login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/login',
  handler: async (request, context) => {
    try {
      const body = await parseJson(request);
      const email = cleanText(body?.email, 254).toLowerCase();
      const password = String(body?.password || '');
      const db = await getDb();
      const customers = db.collection('customers');
      const customer = await customers.findOne({ normalizedEmail: email, provider: 'credentials' });
      const operationTime = nowIso();
      if (customer?.lockedUntil && new Date(customer.lockedUntil).getTime() > Date.now()) {
        return json({ error: 'Too many sign-in attempts. Please try again in 15 minutes' }, 429);
      }
      if (!customer || !(await verifyPassword(password, customer.passwordHash))) {
        if (customer) {
          const failedLoginAttempts = Number(customer.failedLoginAttempts || 0) + 1;
          const lockAccount = failedLoginAttempts >= 5;
          await customers.updateOne(
            { id: customer.id },
            {
              $set: {
                failedLoginAttempts: lockAccount ? 0 : failedLoginAttempts,
                ...(lockAccount ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString() } : {}),
                updatedAt: operationTime,
              },
            },
          );
        }
        return json({ error: 'Email or password is incorrect' }, 401);
      }
      await customers.updateOne(
        { id: customer.id },
        {
          $set: { sessionActive: true, lastSeenAt: operationTime, updatedAt: operationTime },
          $unset: { failedLoginAttempts: '', lockedUntil: '' },
        },
      );
      const user = cleanCustomerDocument(customer);
      return json({ user, token: signSession(user) });
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('forgot-password', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/forgot-password',
  handler: async (request, context) => {
    const genericResponse = json({ ok: true, message: 'If an ANNS account exists, a reset link has been sent.' });
    try {
      const body = await parseJson(request);
      const email = cleanText(body?.email, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return genericResponse;
      const db = await getDb();
      const customer = await db.collection('customers').findOne({ normalizedEmail: email, provider: 'credentials' });
      if (!customer) return genericResponse;
      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await db.collection('customers').updateOne(
        { id: customer.id },
        { $set: { passwordReset: { tokenHash, expiresAt, requestedAt: nowIso() }, updatedAt: nowIso() } },
      );
      const resetUrl = `https://www.annsonline.shop/account?reset=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail(customer, resetUrl);
      return genericResponse;
    } catch (error) {
      context.error('[forgot-password]', error);
      return genericResponse;
    }
  },
});

registerHttp('reset-password', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/reset-password',
  handler: async (request, context) => {
    try {
      const body = await parseJson(request);
      const token = String(body?.token || '');
      const password = String(body?.password || '');
      if (token.length < 32) return json({ error: 'This reset link is invalid or expired' }, 400);
      if (password.length < 10 || password.length > 128 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return json({ error: 'Password must be 10 to 128 characters and include a letter and number' }, 400);
      }
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const db = await getDb();
      const customer = await db.collection('customers').findOne({
        provider: 'credentials',
        'passwordReset.tokenHash': tokenHash,
        'passwordReset.expiresAt': { $gt: nowIso() },
      });
      if (!customer) return json({ error: 'This reset link is invalid or expired' }, 400);
      await db.collection('customers').updateOne(
        { id: customer.id, 'passwordReset.tokenHash': tokenHash },
        { $set: { passwordHash: await hashPassword(password), sessionActive: false, updatedAt: nowIso() }, $unset: { passwordReset: '', failedLoginAttempts: '', lockedUntil: '' } },
      );
      return json({ ok: true });
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('firebase-auth', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/firebase',
  handler: async (request, context) => {
    try {
      const body = await parseJson(request);
      const user = await verifyFirebaseCredential(body?.idToken, body?.phone);
      const operationTime = nowIso();
      const db = await getDb();
      await db.collection('customers').updateOne(
        { id: user.id },
        {
          $set: { ...user, sessionActive: true, lastSeenAt: operationTime, updatedAt: operationTime },
          $setOnInsert: { createdAt: operationTime },
        },
        { upsert: true },
      );
      return json({ user, token: signSession(user) });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 401;
      if (status >= 500) context.error(error);
      return json({ error: status === 503 ? error.message : 'Phone authentication failed' }, status);
    }
  },
});

registerHttp('customer-session', {
  methods: ['GET', 'DELETE'],
  authLevel: 'anonymous',
  route: 'auth/session',
  handler: async (request, context) => {
    try {
      const session = authenticateRequest(request);
      if (!session) return json({ error: 'Authentication required' }, 401);
      const operationTime = nowIso();
      const db = await getDb();
      const customer = await getActiveCustomer(db, session);
      if (!customer) return json({ error: 'Your session has expired. Please sign in again' }, 401);
      const user = cleanCustomerDocument(customer);
      await db.collection('customers').updateOne(
        { id: user.id },
        { $set: { sessionActive: request.method !== 'DELETE', lastSeenAt: operationTime, updatedAt: operationTime } },
      );
      return json(request.method === 'DELETE' ? { ok: true } : { user });
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('admin-login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'admin-login',
  handler: async (request) => (
    isAdminKeyRequest(request)
      ? json({ ok: true, token: signAdminSession() })
      : json({ error: 'Invalid admin credentials' }, 401)
  ),
});

registerHttp('products', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'products',
  handler: async (request, context) => {
    try {
      const db = await getDb();
      const collection = db.collection('products');

      if (request.method === 'GET') {
        // Do not ask MongoDB to sort image-heavy legacy documents in memory.
        // Older uploads stored base64 data directly in the product record and
        // can exceed Atlas' 32 MB sort limit. Move those images into a dedicated
        // collection on read, then return a small, cacheable catalog payload.
        let products = await collection.find({}).toArray();
        const migrated = await Promise.all(products.map(async (rawProduct) => {
          if (!String(rawProduct.image || '').startsWith('data:image/')
            && !normalizeList(rawProduct.otherImages).some((image) => String(image).startsWith('data:image/'))) return rawProduct;
          const product = await externalizeProductImages(db, rawProduct);
          await collection.updateOne(
            { _id: rawProduct._id },
            { $set: { image: product.image, otherImages: product.otherImages, updatedAt: nowIso() } },
          );
          return { ...rawProduct, image: product.image, otherImages: product.otherImages };
        }));
        products = migrated.sort((first, second) => String(first.category || '').localeCompare(String(second.category || '')) || String(first.id || '').localeCompare(String(second.id || '')));
        const response = json(products.map(cleanDocument));
        response.headers['Cache-Control'] = 'public, max-age=5, s-maxage=15, stale-while-revalidate=300';
        return response;
      }

      const unauthorized = requireAdmin(request);
      if (unauthorized) return unauthorized;
      const body = await parseJson(request);

      if (request.method === 'DELETE') {
        const ids = Array.isArray(body?.ids) ? body.ids.map((id) => cleanText(id, 100)).filter(Boolean) : [];
        if (!ids.length) return json({ error: 'At least one product ID is required' }, 400);
        const uniqueIds = [...new Set(ids)];
        const result = await collection.deleteMany({ id: { $in: uniqueIds } });
        await db.collection('productImages').deleteMany({ productId: { $in: uniqueIds } });
        await recordAdminAudit(db, request, 'products.deleted', uniqueIds.join(','), { count: result.deletedCount });
        return json({ ok: true, deleted: result.deletedCount });
      }

      const productList = Array.isArray(body) ? body : body?.products;
      if (!Array.isArray(productList) || !productList.length) return json({ error: 'Products array is required' }, 400);

      const invalidProductIndex = productList.findIndex((product) => !cleanText(product?.id, 100) || !cleanText(product?.name, 200) || !cleanText(product?.category, 100));
      if (invalidProductIndex >= 0) return json({ error: `Product ${invalidProductIndex + 1} requires an ID, name and category` }, 400);
      const suppliedIds = productList.map((product) => cleanText(product.id, 100));
      if (new Set(suppliedIds).size !== suppliedIds.length) return json({ error: 'Every product in an upload must have a unique product ID' }, 400);
      if (new Set(suppliedIds.map((id) => id.toLowerCase())).size !== suppliedIds.length) {
        return json({ error: 'Product IDs must also be unique when letter case is ignored' }, 400);
      }
      const invalidId = suppliedIds.find((id) => !/^[A-Za-z0-9][A-Za-z0-9._-]{1,99}$/.test(normalizeProductId(id)));
      if (invalidId) return json({ error: `Product ID ${invalidId} contains unsupported characters` }, 400);

      const operationTime = nowIso();
      const preparedProducts = await Promise.all(productList
        .map((rawProduct) => externalizeProductImages(db, normalizeProduct(rawProduct), operationTime)));
      const operations = preparedProducts
        .map((product) => {
          return ({
          updateOne: {
            filter: { id: String(product.id) },
            update: { $set: { ...product, id: String(product.id), updatedAt: operationTime }, $setOnInsert: { createdAt: operationTime } },
            upsert: true,
          },
          });
        });
      if (!operations.length) return json({ error: 'No valid products supplied' }, 400);
      const result = await collection.bulkWrite(operations, {
        ordered: false,
        writeConcern: { w: 'majority', wtimeoutMS: 10000 },
      });
      const persisted = await collection.countDocuments({ id: { $in: suppliedIds } });
      if (persisted !== suppliedIds.length) throw new Error('Product persistence verification failed');
      await recordAdminAudit(db, request, 'products.saved', suppliedIds.join(','), { count: persisted });
      return json({ ok: true, saved: persisted, matched: result.matchedCount, modified: result.modifiedCount, added: result.upsertedCount });
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('product-image', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'product-image',
  handler: async (request, context) => {
    try {
      const url = new URL(request.url);
      const productId = cleanText(url.searchParams.get('id'), 100);
      const index = Number(url.searchParams.get('index'));
      const version = cleanText(url.searchParams.get('v'), 16).toLowerCase();
      const requestedVariant = cleanText(url.searchParams.get('size'), 20).toLowerCase();
      if (!productId || !Number.isInteger(index) || index < 0 || index > 4 || !/^[a-f0-9]{16}$/.test(version)) return json({ error: 'Image was not found' }, 404);
      const db = await getDb();
      const image = await db.collection('productImages').findOne({ productId, index, version });
      if (!image?.data) return json({ error: 'Image was not found' }, 404);
      let variant = ['thumbnail', 'listing'].includes(requestedVariant) ? image.variants?.[requestedVariant] : null;
      if (!variant && ['thumbnail', 'listing'].includes(requestedVariant)) {
        const original = Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data.buffer || image.data.value?.() || []);
        const dimensions = requestedVariant === 'thumbnail' ? { width: 320, height: 420, quality: 78 } : { width: 900, height: 1200, quality: 84 };
        variant = await sharp(original, { failOn: 'none', limitInputPixels: 80_000_000 }).rotate()
          .resize({ width: dimensions.width, height: dimensions.height, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: dimensions.quality }).toBuffer();
        await db.collection('productImages').updateOne({ productId, index, version }, { $set: { [`variants.${requestedVariant}`]: variant } });
      }
      const selected = variant || image.data;
      const data = Buffer.isBuffer(selected) ? selected : Buffer.from(selected.buffer || selected.value?.() || []);
      return {
        status: 200,
        body: data,
        headers: {
          'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
          'Content-Type': variant ? 'image/webp' : (image.contentType || 'image/jpeg'),
          'Content-Length': String(data.length),
          'X-Content-Type-Options': 'nosniff',
        },
      };
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('media-image', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'media-image',
  handler: async (request, context) => {
    try {
      const url = new URL(request.url);
      const key = cleanText(url.searchParams.get('key'), 100);
      const version = cleanText(url.searchParams.get('v'), 16).toLowerCase();
      if (!key || !/^[a-z0-9-]{1,100}$/i.test(key) || !/^[a-f0-9]{16}$/.test(version)) return json({ error: 'Image was not found' }, 404);
      const db = await getDb();
      const image = await db.collection('mediaImages').findOne({ key, version });
      if (!image?.data) return json({ error: 'Image was not found' }, 404);
      const data = Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data.buffer || image.data.value?.() || []);
      return {
        status: 200,
        body: data,
        headers: {
          'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
          'Content-Type': image.contentType || 'image/jpeg',
          'Content-Length': String(data.length),
          'X-Content-Type-Options': 'nosniff',
        },
      };
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('reviews', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'reviews',
  handler: async (_request, context) => {
    try {
      const db = await getDb();
      const collection = db.collection('reviews');
      const reviews = await collection
        .find({ published: true })
        .sort({ featured: -1, reviewDate: -1, createdAt: -1 })
        .limit(100)
        .toArray();
      const migrated = await Promise.all(reviews.map(async (rawReview) => {
        if (!String(rawReview.image || '').startsWith('data:image/')) return rawReview;
        const review = await externalizeReviewImage(db, rawReview);
        await collection.updateOne(
          { _id: rawReview._id },
          { $set: { image: review.image, updatedAt: nowIso() } },
        );
        return { ...rawReview, image: review.image };
      }));
      const response = json(migrated.map(cleanDocument));
      response.headers['Cache-Control'] = 'public, max-age=15, s-maxage=60, stale-while-revalidate=300';
      return response;
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('admin-reviews', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'admin/reviews',
  handler: async (request, context) => {
    try {
      const unauthorized = requireAdmin(request);
      if (unauthorized) return unauthorized;
      const db = await getDb();
      const collection = db.collection('reviews');

      if (request.method === 'GET') {
        const reviews = await collection.find({}).sort({ reviewDate: -1, createdAt: -1 }).toArray();
        return json(reviews.map(cleanDocument));
      }

      const body = await parseJson(request);
      if (request.method === 'DELETE') {
        const ids = Array.isArray(body?.ids) ? body.ids.map((id) => cleanText(id, 100)).filter(Boolean) : [];
        if (!ids.length) return json({ error: 'At least one review ID is required' }, 400);
        const result = await collection.deleteMany({ id: { $in: [...new Set(ids)] } });
        await db.collection('mediaImages').deleteMany({ key: { $in: ids.map((id) => `review-${id}`) } });
        await recordAdminAudit(db, request, 'reviews.deleted', ids.join(','), { count: result.deletedCount });
        return json({ ok: true, deleted: result.deletedCount });
      }

      let review = normalizeReview(body?.review || body);
      if (!review.reviewerName || !review.comment) {
        return json({ error: 'Customer name and review text are required' }, 400);
      }
      const operationTime = nowIso();
      review = await externalizeReviewImage(db, review, operationTime);
      if (!review.image) await db.collection('mediaImages').deleteOne({ key: `review-${review.id}` });
      await collection.updateOne(
        { id: review.id },
        { $set: { ...review, updatedAt: operationTime }, $setOnInsert: { createdAt: operationTime } },
        { upsert: true },
      );
      await recordAdminAudit(db, request, 'review.saved', review.id, { published: review.published, featured: review.featured });
      return json({ ok: true, review: cleanDocument(await collection.findOne({ id: review.id })) });
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('flash-sale', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'flash-sale',
  handler: async (_request, context) => {
    try {
      const db = await getDb();
      const sale = await db.collection('flashSales').findOne({ id: 'homepage' });
      const response = json(sale && isFlashSaleActive(sale) ? cleanDocument(sale) : null);
      response.headers['Cache-Control'] = 'public, max-age=5, s-maxage=15, stale-while-revalidate=300';
      return response;
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('admin-flash-sale', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'admin/flash-sale',
  handler: async (request, context) => {
    try {
      const unauthorized = requireAdmin(request);
      if (unauthorized) return unauthorized;
      const db = await getDb();
      const collection = db.collection('flashSales');

      if (request.method === 'GET') {
        return json(cleanDocument(await collection.findOne({ id: 'homepage' }) || normalizeFlashSale()));
      }
      if (request.method === 'DELETE') {
        await collection.deleteOne({ id: 'homepage' });
        await recordAdminAudit(db, request, 'flash_sale.deleted', 'homepage');
        return json({ ok: true });
      }

      const body = await parseJson(request);
      const sale = normalizeFlashSale(body?.sale || body);
      const productIds = [...new Set(sale.items.map((item) => item.productId))];
      const products = productIds.length
        ? await db.collection('products').find({ id: { $in: productIds } }, { projection: { id: 1, price: 1 } }).toArray()
        : [];
      const prices = new Map(products.map((product) => [String(product.id), numericPrice(product.price)]));
      for (const item of sale.items) {
        const originalPrice = prices.get(item.productId);
        if (!Number.isFinite(originalPrice)) return json({ error: `Product ${item.productId} was not found` }, 400);
        if (item.salePrice >= originalPrice) return json({ error: `Sale price for ${item.productId} must be lower than its regular price` }, 400);
      }
      if (sale.active && !sale.items.length) return json({ error: 'Add at least one product before activating the flash sale' }, 400);
      if (sale.startsAt && sale.endsAt && new Date(sale.startsAt) >= new Date(sale.endsAt)) {
        return json({ error: 'The sale end must be after its start' }, 400);
      }
      const operationTime = nowIso();
      sale.bannerImage = await externalizeMediaImage(db, 'flash-sale-banner', sale.bannerImage, operationTime);
      if (!sale.bannerImage) await db.collection('mediaImages').deleteOne({ key: 'flash-sale-banner' });
      await collection.updateOne(
        { id: 'homepage' },
        { $set: { ...sale, updatedAt: operationTime }, $setOnInsert: { createdAt: operationTime } },
        { upsert: true },
      );
      await recordAdminAudit(db, request, 'flash_sale.saved', 'homepage', { active: sale.active, itemCount: sale.items.length });
      return json({ ok: true, sale: cleanDocument(await collection.findOne({ id: 'homepage' })) });
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('customers', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'customers',
  handler: async (request, context) => {
    try {
      const db = await getDb();
      const collection = db.collection('customers');

      if (request.method === 'GET') {
        const unauthorized = requireAdmin(request);
        if (unauthorized) return unauthorized;
        const customers = await collection.find({}).sort({ lastSeenAt: -1 }).toArray();
        return json(customers.map(cleanCustomerDocument));
      }

      if (request.method === 'DELETE') {
        const unauthorized = requireAdmin(request);
        if (unauthorized) return unauthorized;
        const body = await parseJson(request);
        const ids = Array.isArray(body?.ids) ? body.ids.map((id) => cleanText(id, 150)).filter(Boolean) : [];
        if (!ids.length) return json({ error: 'At least one customer ID is required' }, 400);
        const result = await collection.deleteMany({ id: { $in: [...new Set(ids)] } });
        await recordAdminAudit(db, request, 'customers.deleted', ids.join(','), { count: result.deletedCount });
        return json({
          ok: true,
          deleted: result.deletedCount,
          note: 'Paid orders were retained for payment reconciliation and fulfilment.',
        });
      }

      const session = authenticateRequest(request);
      if (!session) return json({ error: 'Authentication required' }, 401);
      const body = await parseJson(request);
      const existing = await collection.findOne({ id: session.sub });
      const customer = {
        id: session.sub,
        name: String(session.name || existing?.name || 'ANNS Customer').slice(0, 120),
        email: String(session.email || existing?.email || '').slice(0, 254),
        phone: String(body.phone || existing?.phone || '').slice(0, 30),
        picture: String(session.picture || existing?.picture || '').slice(0, 1000),
        provider: session.provider,
        sessionActive: body.sessionActive !== false,
        lastSeenAt: nowIso(),
        updatedAt: nowIso(),
      };
      await collection.updateOne(
        { id: customer.id },
        { $set: customer, $setOnInsert: { createdAt: nowIso() } },
        { upsert: true },
      );
      return json({ ok: true, customer });
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('razorpay-create-order', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'payments/razorpay/create-order',
  handler: async (request, context) => {
    try {
      const body = await parseJson(request);
      const requestedItems = Array.isArray(body?.items) ? body.items.slice(0, 50) : [];
      const customer = body?.customer || {};
      const shippingAddress = body?.shippingAddress || {};
      const session = authenticateRequest(request);
      if (!session) return json({ error: 'Sign in before checkout' }, 401);
      const db = await getDb();
      const activeCustomer = await getActiveCustomer(db, session);
      if (!activeCustomer) return json({ error: 'Your session has expired. Please sign in again' }, 401);
      if (!requestedItems.length) return json({ error: 'Cart items are required' }, 400);
      const customerName = cleanText(activeCustomer.name || session.name || customer.name, 120);
      const customerEmail = cleanText(activeCustomer.email || session.email || customer.email, 254).toLowerCase();
      const customerPhone = cleanText(customer.phone, 30);
      if (!customerName || !customerEmail || !customerPhone) return json({ error: 'Name, email and mobile number are required' }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return json({ error: 'Enter a valid email address' }, 400);
      if (!/^\+?[0-9][0-9\s-]{8,14}$/.test(customerPhone)) return json({ error: 'Enter a valid mobile number' }, 400);
      if (!shippingAddress.addressLine1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode) {
        return json({ error: 'Complete shipping address is required' }, 400);
      }
      if (!/^[1-9][0-9]{5}$/.test(cleanText(shippingAddress.postalCode, 20))) return json({ error: 'Enter a valid six-digit PIN code' }, 400);

      const productIds = [...new Set(requestedItems.map((item) => cleanText(item.id, 100)).filter(Boolean))];
      const products = await db.collection('products').find({ id: { $in: productIds } }).toArray();
      const productsById = new Map(products.map((product) => [String(product.id), product]));
      const flashSale = await db.collection('flashSales').findOne({ id: 'homepage' });
      const activeSalePrices = new Map(
        isFlashSaleActive(flashSale)
          ? flashSale.items.map((item) => [String(item.productId), numericPrice(item.salePrice)])
          : [],
      );
      const items = requestedItems.map((requestedItem) => {
        const id = cleanText(requestedItem.id, 100);
        const product = productsById.get(id);
        const quantity = Math.max(1, Math.min(20, Math.trunc(Number(requestedItem.quantity) || 1)));
        const regularPrice = numericPrice(product?.price);
        const configuredSalePrice = activeSalePrices.get(id);
        const price = Number.isFinite(configuredSalePrice) && configuredSalePrice > 0 && configuredSalePrice < regularPrice
          ? configuredSalePrice
          : regularPrice;
        if (!product || !Number.isFinite(price) || price <= 0) {
          const error = new Error(`Product ${id || 'unknown'} is unavailable`);
          error.status = 400;
          throw error;
        }
        const remainingStock = Number(product.stock) - Number(product.sold || 0);
        if (Number.isFinite(remainingStock) && remainingStock < quantity) {
          const error = new Error(`${product.name} does not have enough stock`);
          error.status = 409;
          throw error;
        }
        return {
          id,
          name: cleanText(product.name, 200),
          image: cleanText(product.image, 1000),
          size: cleanText(requestedItem.size, 50),
          color: cleanText(requestedItem.color, 80),
          quantity,
          price,
          lineTotal: Number((price * quantity).toFixed(2)),
        };
      });

      const total = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
      const amount = Math.round(total * 100);
      if (!Number.isSafeInteger(amount) || amount < 100) {
        return json({ error: 'Order total must be at least ₹1.00' }, 400);
      }

      const localOrderId = `ANNS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const customerId = session.sub;
      const razorpayOrder = await createRazorpayOrder({
        amount,
        currency: 'INR',
        receipt: localOrderId.slice(0, 40),
        notes: {
          local_order_id: localOrderId,
          customer_id: customerId,
        },
      });

      const operationTime = nowIso();
      const order = {
        id: localOrderId,
        customerId,
        checkoutMode: 'account',
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
        },
        shippingAddress: {
          addressLine1: cleanText(shippingAddress.addressLine1, 250),
          addressLine2: cleanText(shippingAddress.addressLine2, 250),
          city: cleanText(shippingAddress.city, 100),
          state: cleanText(shippingAddress.state, 100),
          postalCode: cleanText(shippingAddress.postalCode, 20),
          country: 'India',
        },
        items,
        total,
        amountPaise: amount,
        currency: 'INR',
        razorpayOrderId: razorpayOrder.id,
        paymentStatus: 'created',
        status: 'Payment pending',
        createdAt: operationTime,
        updatedAt: operationTime,
      };
      await db.collection('orders').insertOne(order);
      const { keyId } = getCredentials();
      return json({
        keyId,
        orderId: razorpayOrder.id,
        localOrderId,
        amount,
        currency: 'INR',
      }, 201);
    } catch (error) {
      return paymentError(context, error);
    }
  },
});

registerHttp('razorpay-verify-payment', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'payments/razorpay/verify',
  handler: async (request, context) => {
    try {
      const body = await parseJson(request);
      if (!body?.razorpay_order_id || !body?.razorpay_payment_id || !body?.razorpay_signature) {
        return json({ error: 'Payment verification details are required' }, 400);
      }
      const session = authenticateRequest(request);
      const db = await getDb();
      const order = await db.collection('orders').findOne({ razorpayOrderId: cleanText(body.razorpay_order_id, 100) });
      if (!order) return json({ error: 'Order was not found' }, 404);
      if (order.checkoutMode !== 'guest' && (!session || order.customerId !== session.sub)) {
        return json({ error: 'Order does not belong to this customer' }, 403);
      }
      const signatureValid = verifyPaymentSignature({
        orderId: order.razorpayOrderId,
        paymentId: cleanText(body.razorpay_payment_id, 100),
        signature: cleanText(body.razorpay_signature, 300),
      });
      if (!signatureValid) return json({ error: 'Payment signature is invalid' }, 400);

      let payment = await getRazorpayPayment(cleanText(body.razorpay_payment_id, 100));
      if (payment.order_id !== order.razorpayOrderId || Number(payment.amount) !== order.amountPaise) {
        return json({ error: 'Payment does not match this order' }, 400);
      }
      if (payment.status === 'authorized') payment = await captureRazorpayPayment(payment.id, order.amountPaise);
      if (payment.status !== 'captured') return json({ error: 'Payment has not been captured' }, 409);

      let completedOrder = await finalizeCapturedOrder(db, order, payment);
      completedOrder = await sendCapturedOrderConfirmation(db, completedOrder, context);
      return json({ ok: true, order: cleanDocument(completedOrder) });
    } catch (error) {
      return paymentError(context, error);
    }
  },
});

registerHttp('razorpay-webhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'payments/razorpay/webhook',
  handler: async (request, context) => {
    try {
      const payload = await request.text();
      const signature = request.headers.get('x-razorpay-signature');
      if (!verifyWebhookSignature(payload, signature)) return json({ error: 'Invalid webhook signature' }, 401);
      const event = JSON.parse(payload);
      const refund = event.payload?.refund?.entity;
      if (refund?.payment_id && ['refund.processed', 'refund.failed'].includes(event.event)) {
        const db = await getDb();
        const refundType = event.event === 'refund.processed' ? 'processed' : 'failed';
        await db.collection('orders').updateOne(
          { razorpayPaymentId: refund.payment_id },
          { $set: { refundStatus: refundType, status: refundType === 'processed' ? 'Refunded' : 'Refund failed — review required', updatedAt: nowIso() } },
        );
        const refundedOrder = await db.collection('orders').findOne({ razorpayPaymentId: refund.payment_id });
        if (refundedOrder) await sendRefundNotifications(db, refundedOrder, refundType, context);
        return json({ ok: true });
      }
      const payment = event.payload?.payment?.entity;
      if (!payment?.order_id) return json({ ok: true });
      const db = await getDb();
      const order = await db.collection('orders').findOne({ razorpayOrderId: payment.order_id });
      if (!order) return json({ ok: true });

      if (event.event === 'payment.captured' || event.event === 'order.paid') {
        const completedOrder = await finalizeCapturedOrder(db, order, payment);
        await sendCapturedOrderConfirmation(db, completedOrder, context);
      } else if (event.event === 'payment.failed') {
        await db.collection('orders').updateOne(
          { id: order.id, paymentStatus: { $ne: 'captured' } },
          { $set: { paymentStatus: 'failed', status: 'Payment failed', updatedAt: nowIso() } },
        );
      }
      return json({ ok: true });
    } catch (error) {
      return paymentError(context, error);
    }
  },
});

registerHttp('customer-orders', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'account/orders',
  handler: async (request, context) => {
    try {
      const session = authenticateRequest(request);
      if (!session) return json({ error: 'Authentication required' }, 401);
      const db = await getDb();
      const customer = await getActiveCustomer(db, session);
      if (!customer) return json({ error: 'Your session has expired. Please sign in again' }, 401);
      const orders = db.collection('orders');
      if (request.method === 'GET') {
        const history = await orders.find({ customerId: customer.id, paymentStatus: 'captured' })
          .sort({ paidAt: -1, createdAt: -1 }).limit(250).toArray();
        return json(history.map(cleanDocument));
      }
      const body = await parseJson(request);
      const orderId = cleanText(body?.id, 100);
      const reason = cleanText(body?.reason, 500);
      if (!orderId || reason.length < 3) return json({ error: 'Choose an order and provide a cancellation reason' }, 400);
      const order = await orders.findOne({ id: orderId, customerId: customer.id, paymentStatus: 'captured' });
      if (!order) return json({ error: 'Paid order was not found' }, 404);
      if (['shipped', 'out_for_delivery', 'delivered'].includes(order.fulfillmentStatus)) return json({ error: 'This order has already shipped and can no longer be cancelled' }, 409);
      if (['requested', 'approved'].includes(order.cancellation?.status) || order.refundStatus) return json({ error: 'A cancellation or refund already exists for this order' }, 409);
      await orders.updateOne(
        { id: orderId, customerId: customer.id },
        { $set: { cancellation: { status: 'requested', reason, requestedAt: nowIso() }, status: 'Cancellation requested', updatedAt: nowIso() } },
      );
      const updatedOrder = await orders.findOne({ id: orderId });
      await sendRefundNotifications(db, updatedOrder, 'requested', context);
      const notifiedOrder = await orders.findOne({ id: orderId });
      return json({ ok: true, order: cleanDocument(notifiedOrder) });
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('orders', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'orders',
  handler: async (request, context) => {
    try {
      const db = await getDb();
      const collection = db.collection('orders');

      if (request.method === 'GET') {
        const unauthorized = requireAdmin(request);
        if (unauthorized) return unauthorized;
        // Razorpay requires an order before Checkout opens, but it is not a
        // business order until payment has been captured. Keep incomplete
        // attempts for reconciliation without reporting them as sales.
        const orders = await collection
          .find({ paymentStatus: 'captured' })
          .sort({ paidAt: -1, createdAt: -1 })
          .limit(5000)
          .toArray();
        return json(orders.map(cleanDocument));
      }

      const unauthorized = requireAdmin(request);
      if (unauthorized) return unauthorized;
      const body = await parseJson(request);
      if (request.method === 'PATCH') {
        const orderId = cleanText(body?.id, 100);
        if (body?.action === 'approve-cancellation') {
          if (!orderId) return json({ error: 'Order ID is required' }, 400);
          const existing = await collection.findOne({ id: orderId, paymentStatus: 'captured' });
          if (!existing) return json({ error: 'Paid order was not found' }, 404);
          if (existing.cancellation?.status !== 'requested') return json({ error: 'The customer has not requested cancellation' }, 409);
          if (['shipped', 'out_for_delivery', 'delivered'].includes(existing.fulfillmentStatus)) return json({ error: 'Shipped or delivered orders cannot be refunded through cancellation' }, 409);
          if (!existing.razorpayPaymentId) return json({ error: 'Razorpay payment ID is missing; reconcile this order manually' }, 409);
          const claim = await collection.updateOne(
            { id: orderId, 'cancellation.status': 'requested', refundStatus: { $exists: false } },
            { $set: { 'cancellation.status': 'refunding', 'cancellation.refundStartedAt': nowIso(), updatedAt: nowIso() } },
          );
          if (claim.modifiedCount !== 1) return json({ error: 'This refund is already being processed' }, 409);
          let refund;
          try {
            refund = await refundRazorpayPayment(existing.razorpayPaymentId, existing.amountPaise, { local_order_id: existing.id, reason: existing.cancellation.reason });
          } catch (error) {
            await collection.updateOne(
              { id: orderId, 'cancellation.status': 'refunding' },
              { $set: { 'cancellation.status': 'requested', 'cancellation.refundError': cleanText(error.message, 300), updatedAt: nowIso() }, $unset: { 'cancellation.refundStartedAt': '' } },
            );
            throw error;
          }
          const refundStatus = refund.status === 'processed' ? 'processed' : 'pending';
          if (existing.inventoryStatus !== 'restored' && existing.items?.length) {
            await db.collection('products').bulkWrite(existing.items.map((item) => ({
              updateOne: {
                filter: { id: item.id },
                update: [{ $set: { sold: { $max: [0, { $subtract: [{ $ifNull: ['$sold', 0] }, Number(item.quantity) || 0] }] }, updatedAt: nowIso() } }],
              },
            })), { ordered: false });
          }
          await collection.updateOne(
            { id: orderId, 'cancellation.status': 'refunding' },
            { $set: { 'cancellation.status': 'approved', 'cancellation.approvedAt': nowIso(), razorpayRefundId: refund.id, refundStatus, inventoryStatus: 'restored', status: refundStatus === 'processed' ? 'Refunded' : 'Refund initiated', updatedAt: nowIso() }, $unset: { 'cancellation.refundStartedAt': '', 'cancellation.refundError': '' } },
          );
          await recordAdminAudit(db, request, 'order.refund_initiated', orderId, { refundId: refund.id, amountPaise: existing.amountPaise });
          const updatedOrder = await collection.findOne({ id: orderId });
          const notifiedOrder = await sendRefundNotifications(db, updatedOrder, 'initiated', context);
          return json({ ok: true, order: cleanDocument(notifiedOrder) });
        }
        const fulfillmentStatus = cleanText(body?.fulfillmentStatus, 30).toLowerCase();
        const allowedStatuses = ['processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
        if (!orderId || !allowedStatuses.includes(fulfillmentStatus)) return json({ error: 'A valid order and fulfilment status are required' }, 400);
        const existing = await collection.findOne({ id: orderId, paymentStatus: 'captured' });
        if (!existing) return json({ error: 'Paid order was not found' }, 404);
        if (existing.cancellation?.status === 'requested' || existing.refundStatus) return json({ error: 'Resolve the cancellation/refund before updating fulfilment' }, 409);
        const currentIndex = allowedStatuses.indexOf(existing.fulfillmentStatus || 'processing');
        const nextIndex = allowedStatuses.indexOf(fulfillmentStatus);
        if (nextIndex < currentIndex) return json({ error: 'Order status cannot be moved backwards' }, 409);
        const courier = cleanText(body?.courier, 100);
        const trackingNumber = cleanText(body?.trackingNumber, 120);
        const trackingUrlInput = cleanText(body?.trackingUrl, 1000);
        const trackingUrl = /^https:\/\//i.test(trackingUrlInput) ? trackingUrlInput : '';
        if (['shipped', 'out_for_delivery'].includes(fulfillmentStatus) && (!courier || !trackingNumber)) return json({ error: 'Courier and tracking number are required after an order ships' }, 400);
        const changed = fulfillmentStatus !== existing.fulfillmentStatus
          || courier !== (existing.courier || '')
          || trackingNumber !== (existing.trackingNumber || '')
          || trackingUrl !== (existing.trackingUrl || '');
        const operationTime = nowIso();
        await collection.updateOne(
          { id: orderId, paymentStatus: 'captured' },
          { $set: { fulfillmentStatus, courier, trackingNumber, trackingUrl, status: fulfillmentStatus.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' '), updatedAt: operationTime } },
        );
        let updatedOrder = await collection.findOne({ id: orderId });
        await recordAdminAudit(db, request, 'order.fulfillment_updated', orderId, { from: existing.fulfillmentStatus || 'processing', to: fulfillmentStatus, courier, trackingNumber });
        if (changed && ['shipped', 'out_for_delivery', 'delivered'].includes(fulfillmentStatus) && process.env.RESEND_API_KEY) {
          try {
            const result = await sendFulfillmentUpdateEmail(updatedOrder);
            await collection.updateOne(
              { id: orderId },
              { $set: { [`fulfillmentNotifications.${fulfillmentStatus}`]: { status: 'sent', emailId: result.id, sentAt: nowIso() } } },
            );
          } catch (error) {
            context.error('[fulfillment-email]', error);
            await collection.updateOne(
              { id: orderId },
              { $set: { [`fulfillmentNotifications.${fulfillmentStatus}`]: { status: 'failed', error: cleanText(error.message, 300), attemptedAt: nowIso() } } },
            );
          }
          updatedOrder = await collection.findOne({ id: orderId });
        }
        return json({ ok: true, order: cleanDocument(updatedOrder) });
      }
      if (!body?.id || !body?.customerId || !Array.isArray(body.items)) return json({ error: 'Order id, customer id and items are required' }, 400);
      const order = {
        id: String(body.id),
        customerId: String(body.customerId),
        items: body.items.slice(0, 100),
        total: Number(body.total) || 0,
        status: String(body.status || 'Placed').slice(0, 40),
        createdAt: body.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
      await collection.updateOne({ id: order.id }, { $set: order }, { upsert: true });
      return json({ ok: true, order }, 201);
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('admin-audit-logs', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'admin/audit-logs',
  handler: async (request, context) => {
    const unauthorized = requireAdmin(request);
    if (unauthorized) return unauthorized;
    try {
      const db = await getDb();
      const logs = await db.collection('adminAuditLogs').find({}, { projection: { _id: 0, ipHash: 0 } })
        .sort({ createdAt: -1 }).limit(250).toArray();
      return json(logs);
    } catch (error) { return handleError(context, error); }
  },
});

registerHttp('payment-reconciliation', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'maintenance/payment-reconciliation',
  handler: async (request, context) => {
    if (!cronAuthorized(request)) return json({ error: 'Unauthorized' }, 401);
    try {
      const db = await getDb();
      const cutoff = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString();
      const candidates = await db.collection('orders').find({
        paymentStatus: { $in: ['created', 'failed'] },
        razorpayOrderId: { $exists: true, $ne: '' },
        createdAt: { $gte: cutoff },
      }).sort({ createdAt: -1 }).limit(50).toArray();
      let captured = 0;
      let checked = 0;
      const errors = [];
      for (const order of candidates) {
        try {
          const response = await getRazorpayOrderPayments(order.razorpayOrderId);
          const payments = Array.isArray(response.items) ? response.items : [];
          let payment = payments.find((item) => item.status === 'captured' && Number(item.amount) === order.amountPaise);
          const authorized = payments.find((item) => item.status === 'authorized' && Number(item.amount) === order.amountPaise);
          if (!payment && authorized) payment = await captureRazorpayPayment(authorized.id, order.amountPaise);
          checked += 1;
          if (payment?.status === 'captured' && payment.order_id === order.razorpayOrderId && Number(payment.amount) === order.amountPaise) {
            let completed = await finalizeCapturedOrder(db, order, payment);
            completed = await sendCapturedOrderConfirmation(db, completed, context);
            captured += 1;
          }
          await db.collection('orders').updateOne({ id: order.id }, { $set: { lastReconciledAt: nowIso(), updatedAt: nowIso() } });
        } catch (error) {
          context.error('[payment-reconciliation]', order.id, error);
          errors.push({ orderId: order.id, error: cleanText(error.message, 160) });
        }
      }
      return json({ ok: errors.length === 0, checked, captured, errors });
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('email-retries', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'maintenance/email-retries',
  handler: async (request, context) => {
    if (!cronAuthorized(request)) return json({ error: 'Unauthorized' }, 401);
    try {
      const db = await getDb();
      const failedOrders = await db.collection('orders').find({ paymentStatus: 'captured', 'confirmationEmail.status': 'failed' }).limit(25).toArray();
      for (const order of failedOrders) await sendCapturedOrderConfirmation(db, order, context);
      const failedWelcomes = await db.collection('customers').find({ 'welcomeEmail.status': 'failed', email: { $exists: true, $ne: '' } }).limit(25).toArray();
      for (const customer of failedWelcomes) await sendWelcomeEmailOnce(db, customer, context);
      const failedAdminPurchases = await db.collection('orders').find({ paymentStatus: 'captured', 'adminPurchaseEmail.status': 'failed' }).limit(25).toArray();
      for (const order of failedAdminPurchases) {
        try {
          const result = await sendAdminOrderEmail(order, order.deliveryEstimate || getDeliveryEstimate(order.paidAt));
          await db.collection('orders').updateOne({ id: order.id }, { $set: { adminPurchaseEmail: { status: 'sent', emailId: result.id, sentAt: nowIso() }, updatedAt: nowIso() } });
        } catch (error) {
          await db.collection('orders').updateOne({ id: order.id }, { $set: { adminPurchaseEmail: { status: 'failed', error: cleanText(error.message, 300), attemptedAt: nowIso() }, updatedAt: nowIso() } });
        }
      }
      const failedFulfillment = await db.collection('orders').find({ paymentStatus: 'captured', fulfillmentStatus: { $in: ['shipped', 'out_for_delivery', 'delivered'] } }).limit(50).toArray();
      let fulfillmentRetried = 0;
      for (const order of failedFulfillment) {
        if (order.fulfillmentNotifications?.[order.fulfillmentStatus]?.status !== 'failed') continue;
        try {
          const result = await sendFulfillmentUpdateEmail(order);
          await db.collection('orders').updateOne({ id: order.id }, { $set: { [`fulfillmentNotifications.${order.fulfillmentStatus}`]: { status: 'sent', emailId: result.id, sentAt: nowIso() } } });
          fulfillmentRetried += 1;
        } catch (error) { context.error('[fulfillment-email-retry]', error); }
      }
      const failedCancellationNotifications = await db.collection('orders').find({ 'cancellationNotification.status': 'failed' }).limit(25).toArray();
      for (const order of failedCancellationNotifications) await sendRefundNotifications(db, order, 'requested', context);
      let refundNotificationsRetried = 0;
      for (const type of ['initiated', 'processed', 'failed']) {
        const failedRefunds = await db.collection('orders').find({ [`refundNotifications.${type}.status`]: 'failed' }).limit(25).toArray();
        for (const order of failedRefunds) await sendRefundNotifications(db, order, type, context);
        refundNotificationsRetried += failedRefunds.length;
      }
      return json({ ok: true, orderEmailsRetried: failedOrders.length, adminPurchaseEmailsRetried: failedAdminPurchases.length, welcomeEmailsRetried: failedWelcomes.length, fulfillmentRetried, cancellationEmailsRetried: failedCancellationNotifications.length, refundNotificationsRetried });
    } catch (error) { return handleError(context, error); }
  },
});

module.exports = { registeredRoutes };
