const { MongoClient, ServerApiVersion } = require('mongodb');

let clientPromise;
let indexesPromise;

const isRetryableMongoError = (error) => {
  const name = String(error?.name || '');
  const message = String(error?.message || '');
  return [
    'MongoNetworkError',
    'MongoNetworkTimeoutError',
    'MongoPoolClearedError',
    'MongoServerSelectionError',
  ].includes(name)
    || error?.hasErrorLabel?.('ResetPool')
    || /connection pool|server selection|socket|tls|econnreset|closed connection/i.test(message);
};

const discardClient = async (failedPromise) => {
  if (clientPromise !== failedPromise) return;
  clientPromise = undefined;
  indexesPromise = undefined;
  try {
    const client = await failedPromise;
    await client.close();
  } catch {
    // The failed connection has already been discarded. A later request will
    // create a fresh client instead of reusing a poisoned serverless pool.
  }
};

const getClient = () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured');

  if (!clientPromise) {
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      appName: 'ANNS-Azure-Functions',
      // Keep each serverless instance deliberately small. Vercel can create
      // several instances at once, so a large per-instance pool can overwhelm
      // Atlas during a cold image load.
      maxPoolSize: 4,
      minPoolSize: 0,
      maxConnecting: 1,
      maxIdleTimeMS: 60_000,
      waitQueueTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
      socketTimeoutMS: 20_000,
      serverSelectionTimeoutMS: 8000,
      retryReads: true,
      retryWrites: true,
    });
    const connecting = client.connect().catch((error) => {
      if (clientPromise === connecting) clientPromise = undefined;
      throw error;
    });
    clientPromise = connecting;
  }
  return clientPromise;
};

const ensureIndexes = async (db) => {
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      db.collection('products').createIndex({ id: 1 }, { unique: true }),
      db.collection('products').createIndex({ category: 1, id: 1 }),
      db.collection('productImages').createIndex({ productId: 1, index: 1 }, { unique: true }),
      db.collection('mediaImages').createIndex({ key: 1 }, { unique: true }),
      db.collection('customers').createIndex({ id: 1 }, { unique: true }),
      db.collection('customers').createIndex(
        { normalizedEmail: 1 },
        { unique: true, partialFilterExpression: { normalizedEmail: { $type: 'string' } } },
      ),
      db.collection('customers').createIndex({ lastSeenAt: -1 }),
      db.collection('orders').createIndex({ id: 1 }, { unique: true }),
      db.collection('orders').createIndex({ razorpayOrderId: 1 }, { unique: true, sparse: true }),
      db.collection('orders').createIndex({ razorpayPaymentId: 1 }, { unique: true, sparse: true }),
      db.collection('orders').createIndex({ customerId: 1, createdAt: -1 }),
      db.collection('reviews').createIndex({ id: 1 }, { unique: true }),
      db.collection('reviews').createIndex({ published: 1, featured: 1, reviewDate: -1 }),
      db.collection('reviews').createIndex({ productId: 1, published: 1, reviewDate: -1 }),
      db.collection('reviews').createIndex(
        { customerId: 1, productId: 1 },
        { unique: true, partialFilterExpression: { customerId: { $type: 'string' } } },
      ),
      db.collection('flashSales').createIndex({ id: 1 }, { unique: true }),
      db.collection('flashSales').createIndex({ active: 1, startsAt: 1, endsAt: 1 }),
      db.collection('analyticsEvents').createIndex({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 }),
      db.collection('analyticsEvents').createIndex({ visitorId: 1, createdAt: -1 }),
    ]).catch((error) => {
      indexesPromise = undefined;
      throw error;
    });
  }
  await indexesPromise;
};

const getDb = async () => {
  const client = await getClient();
  const db = client.db(process.env.MONGODB_DB_NAME || 'anns');
  await ensureIndexes(db);
  return db;
};

const withDbRetry = async (operation) => {
  const firstClientPromise = clientPromise || getClient();
  try {
    const client = await firstClientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'anns');
    await ensureIndexes(db);
    return await operation(db);
  } catch (error) {
    if (!isRetryableMongoError(error)) throw error;
    await discardClient(firstClientPromise);
    const db = await getDb();
    return operation(db);
  }
};

module.exports = { getClient, getDb, isRetryableMongoError, withDbRetry };
