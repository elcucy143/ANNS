const { app } = require('@azure/functions');
const crypto = require('node:crypto');
const { getDb } = require('../lib/db');
const { handleError, isAdminRequest, json, parseJson, requireAdmin } = require('../lib/http');
const {
  captureRazorpayPayment,
  createRazorpayOrder,
  getCredentials,
  getRazorpayPayment,
  verifyPaymentSignature,
  verifyWebhookSignature,
} = require('../lib/razorpay');

const cleanDocument = (document) => {
  const cleaned = { ...document };
  delete cleaned._id;
  return cleaned;
};
const nowIso = () => new Date().toISOString();
const cleanText = (value, maxLength = 200) => String(value || '').trim().slice(0, maxLength);
const numericPrice = (value) => Number(String(value ?? '').replace(/[^0-9.]/g, ''));
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

const finalizeCapturedOrder = async (db, order, payment) => {
  const orders = db.collection('orders');
  const update = await orders.updateOne(
    { id: order.id, paymentStatus: { $ne: 'captured' } },
    {
      $set: {
        razorpayPaymentId: payment.id,
        paymentStatus: 'captured',
        status: 'Paid',
        paidAt: nowIso(),
        updatedAt: nowIso(),
      },
    },
  );

  if (update.modifiedCount) {
    await db.collection('products').bulkWrite(order.items.map((item) => ({
      updateOne: {
        filter: { id: item.id },
        update: { $inc: { stock: -item.quantity, sold: item.quantity }, $set: { updatedAt: nowIso() } },
      },
    })), { ordered: false });
  }

  return orders.findOne({ id: order.id });
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

registerHttp('admin-login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'admin-login',
  handler: async (request) => (
    isAdminRequest(request) ? json({ ok: true }) : json({ error: 'Invalid admin credentials' }, 401)
  ),
});

registerHttp('products', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'products',
  handler: async (request, context) => {
    try {
      const db = await getDb();
      const collection = db.collection('products');

      if (request.method === 'GET') {
        const products = await collection.find({}).sort({ category: 1, id: 1 }).toArray();
        return json(products.map(cleanDocument));
      }

      const unauthorized = requireAdmin(request);
      if (unauthorized) return unauthorized;
      const body = await parseJson(request);
      const productList = Array.isArray(body) ? body : body?.products;
      if (!Array.isArray(productList) || !productList.length) return json({ error: 'Products array is required' }, 400);

      const operationTime = nowIso();
      const operations = productList
        .filter((product) => product?.id && product?.name && product?.category)
        .map((product) => ({
          updateOne: {
            filter: { id: String(product.id) },
            update: { $set: { ...product, id: String(product.id), updatedAt: operationTime }, $setOnInsert: { createdAt: operationTime } },
            upsert: true,
          },
        }));
      if (!operations.length) return json({ error: 'No valid products supplied' }, 400);
      const result = await collection.bulkWrite(operations, { ordered: false });
      return json({ ok: true, matched: result.matchedCount, modified: result.modifiedCount, added: result.upsertedCount });
    } catch (error) {
      return handleError(context, error);
    }
  },
});

registerHttp('customers', {
  methods: ['GET', 'POST'],
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
        return json(customers.map(cleanDocument));
      }

      const body = await parseJson(request);
      if (!body?.id) return json({ error: 'Customer id is required' }, 400);
      const existing = await collection.findOne({ id: String(body.id) });
      const customer = {
        id: String(body.id),
        name: String(body.name || existing?.name || 'ANNS Customer').slice(0, 120),
        email: String(body.email || existing?.email || '').slice(0, 254),
        phone: String(body.phone || existing?.phone || '').slice(0, 30),
        picture: String(body.picture || existing?.picture || '').slice(0, 1000),
        provider: String(body.provider || existing?.provider || 'email').slice(0, 30),
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
      if (!customer.id || !requestedItems.length) return json({ error: 'Customer and cart items are required' }, 400);
      if (!shippingAddress.addressLine1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode) {
        return json({ error: 'Complete shipping address is required' }, 400);
      }

      const db = await getDb();
      const productIds = [...new Set(requestedItems.map((item) => cleanText(item.id, 100)).filter(Boolean))];
      const products = await db.collection('products').find({ id: { $in: productIds } }).toArray();
      const productsById = new Map(products.map((product) => [String(product.id), product]));
      const items = requestedItems.map((requestedItem) => {
        const id = cleanText(requestedItem.id, 100);
        const product = productsById.get(id);
        const quantity = Math.max(1, Math.min(20, Math.trunc(Number(requestedItem.quantity) || 1)));
        const price = numericPrice(product?.price);
        if (!product || !Number.isFinite(price) || price <= 0) {
          const error = new Error(`Product ${id || 'unknown'} is unavailable`);
          error.status = 400;
          throw error;
        }
        if (Number.isFinite(Number(product.stock)) && Number(product.stock) < quantity) {
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
      if (!amount) return json({ error: 'Order total must be greater than zero' }, 400);

      const localOrderId = `ANNS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const razorpayOrder = await createRazorpayOrder({
        amount,
        currency: 'INR',
        receipt: localOrderId.slice(0, 40),
        notes: {
          local_order_id: localOrderId,
          customer_id: cleanText(customer.id, 100),
        },
      });

      const operationTime = nowIso();
      const order = {
        id: localOrderId,
        customerId: cleanText(customer.id, 100),
        customer: {
          name: cleanText(customer.name, 120),
          email: cleanText(customer.email, 254),
          phone: cleanText(customer.phone, 30),
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
      await db.collection('customers').updateOne(
        { id: order.customerId },
        {
          $set: {
            id: order.customerId,
            ...order.customer,
            lastSeenAt: operationTime,
            updatedAt: operationTime,
          },
          $setOnInsert: { createdAt: operationTime, sessionActive: true },
        },
        { upsert: true },
      );
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
      const db = await getDb();
      const order = await db.collection('orders').findOne({ razorpayOrderId: cleanText(body.razorpay_order_id, 100) });
      if (!order) return json({ error: 'Order was not found' }, 404);
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

      const completedOrder = await finalizeCapturedOrder(db, order, payment);
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
      const payment = event.payload?.payment?.entity;
      if (!payment?.order_id) return json({ ok: true });
      const db = await getDb();
      const order = await db.collection('orders').findOne({ razorpayOrderId: payment.order_id });
      if (!order) return json({ ok: true });

      if (event.event === 'payment.captured' || event.event === 'order.paid') {
        await finalizeCapturedOrder(db, order, payment);
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

registerHttp('orders', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'orders',
  handler: async (request, context) => {
    try {
      const db = await getDb();
      const collection = db.collection('orders');

      if (request.method === 'GET') {
        const unauthorized = requireAdmin(request);
        if (unauthorized) return unauthorized;
        const orders = await collection.find({}).sort({ createdAt: -1 }).limit(5000).toArray();
        return json(orders.map(cleanDocument));
      }

      const body = await parseJson(request);
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

module.exports = { registeredRoutes };
