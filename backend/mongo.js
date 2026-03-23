const mongoose = require('mongoose');

async function connectMongo() {
  const uri = String(process.env.MONGODB_URI || '').trim();
  if (!uri) {
    throw new Error('MONGODB_URI is missing. Configure backend/.env to use Mongo Atlas.');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    autoIndex: true,
  });

  const dbName = mongoose.connection?.name || '(unknown-db)';
  const host = mongoose.connection?.host || '(unknown-host)';
  console.log(`MongoDB connected: db=${dbName} host=${host}`);
}

module.exports = { connectMongo };
