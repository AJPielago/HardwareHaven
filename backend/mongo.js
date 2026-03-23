const mongoose = require('mongoose');

async function connectMongo() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shopapp';

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    autoIndex: true,
  });

  console.log('MongoDB connected');
}

module.exports = { connectMongo };
