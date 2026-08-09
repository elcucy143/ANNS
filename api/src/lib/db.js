const { MongoClient, ServerApiVersion } = require('mongodb');

let clientPromise;
let indexesPromise;

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
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
    });
    clientPromise = client.connect().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }
  return clientPromise;
};

const ensureIndexes = async (db) => {
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      db.collection('products').createIndex({ id: 1 }, { unique: true }),
      db.collection('customers').createIndex({ id: 1 }, { unique: true }),
      db.collection('customers').createIndex({ lastSeenAt: -1 }),
      db.collection('orders').createIndex({ id: 1 }, { unique: true }),
      db.collection('orders').createIndex({ razorpayOrderId: 1 }, { unique: true, sparse: true }),
      db.collection('orders').createIndex({ razorpayPaymentId: 1 }, { unique: true, sparse: true }),
      db.collection('orders').createIndex({ customerId: 1, createdAt: -1 }),
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

module.exports = { getDb };
