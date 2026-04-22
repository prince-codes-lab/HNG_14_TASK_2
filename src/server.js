require('dotenv').config();
const app       = require('./app');
const connectDB = require('./db/connection');

const PORT = process.env.PORT || 3000;

async function start() {
  // Connect to MongoDB — exits the process if this fails
  await connectDB();

  // Now start accepting HTTP traffic
  app.listen(PORT, () => {
    console.log(`🚀  Insighta API running on port ${PORT}`);
    console.log(`    GET /api/profiles`);
    console.log(`    GET /api/profiles/search?q=...`);
    console.log(`    GET /health`);
  });
}

start();
