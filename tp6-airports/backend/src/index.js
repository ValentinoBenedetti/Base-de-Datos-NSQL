import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { connectDbs } from './db.js';
import { runImporter } from './importer.js';
import routes from './routes.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Basic Request Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Register routes
app.use('/api', routes);

// Base route health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

async function main() {
  try {
    // 1. Connect to all NoSQL databases
    await connectDbs();

    // 2. Run data importer
    await runImporter();

    // 3. Start server
    app.listen(config.port, () => {
      console.log(`========================================`);
      console.log(` Airport API running on port ${config.port}`);
      console.log(` URL: http://localhost:${config.port}/api`);
      console.log(`========================================`);
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

main();
