const path = require('node:path');
const productsByCategory = require(path.resolve(__dirname, '../src/assets/json/products.json'));
const { getDb } = require('../api/src/lib/db');

const products = Object.entries(productsByCategory).flatMap(([category, items]) => (
  items.map((product) => ({ ...product, category, sold: Number(product.sold) || 0 }))
));

const run = async () => {
  const db = await getDb();
  const operationTime = new Date().toISOString();
  const operations = products.map((product) => ({
    updateOne: {
      filter: { id: product.id },
      update: { $set: { ...product, updatedAt: operationTime }, $setOnInsert: { createdAt: operationTime } },
      upsert: true,
    },
  }));
  const result = await db.collection('products').bulkWrite(operations, { ordered: false });
  console.log(JSON.stringify({ total: products.length, added: result.upsertedCount, updated: result.modifiedCount }));
  process.exit(0);
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
