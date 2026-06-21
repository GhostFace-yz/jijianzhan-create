import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../');

// Load .env from project root if present. Existing environment variables take precedence.
try {
  process.loadEnvFile(path.join(projectRoot, '.env'));
} catch {
  // .env may be missing; rely on environment variables already set.
}

// Normalize SQLite DATABASE_URL to an absolute path so Prisma resolves it correctly
// regardless of the working directory used to start the server.
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl?.startsWith('file:')) {
  const dbPath = databaseUrl.slice('file:'.length);
  if (!path.isAbsolute(dbPath)) {
    process.env.DATABASE_URL = 'file:' + path.resolve(projectRoot, dbPath);
  }
}

import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? '3000');

async function main() {
  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down server...`);
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
