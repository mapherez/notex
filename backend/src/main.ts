import { createServer } from 'node:http';

import { createApplication } from './app.js';
import { createAuth, ensureDesktopOAuthClient, migrateAuth } from './auth.js';
import { BridgeRegistry } from './bridge/registry.js';
import { installBridgeServer } from './bridge/server.js';
import { loadConfig } from './config.js';
import { BackendDatabase } from './database.js';
import { createLogger } from './logger.js';

const config = loadConfig();
const logger = createLogger(config);
const database = new BackendDatabase(config.databasePath);
database.migrate();
const auth = createAuth(config, database);
await migrateAuth(auth);
const desktopClientId = await ensureDesktopOAuthClient(auth, database);
const registry = new BridgeRegistry(database);
const application = createApplication({ auth, config, database, registry, desktopClientId, logger });
const server = createServer(application.app);
const closeBridge = installBridgeServer(server, config, registry, logger);

server.listen(config.port, config.host, () => {
  logger.info({ event: 'server_started', host: config.host, port: config.port });
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ event: 'server_stopping', signal });
  await closeBridge();
  await application.close();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  database.close();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal).then(() => process.exit(0), () => process.exit(1));
  });
}
