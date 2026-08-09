const { app } = require('@azure/functions');
const { getDb } = require('../lib/db');
const { handleError, isAdminRequest, json, parseJson, requireAdmin } = require('../lib/http');

const cleanDocument = (document) => {
  const cleaned = { ...document };
  delete cleaned._id;
  return cleaned;
};
const nowIso = () => new Date().toISOString();

app.http('health', {
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

app.http('admin-login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'admin-login',
  handler: async (request) => (
    isAdminRequest(request) ? json({ ok: true }) : json({ error: 'Invalid admin credentials' }, 401)
  ),
});

app.http('products', {
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

app.http('customers', {
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

app.http('orders', {
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
