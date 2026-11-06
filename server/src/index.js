import { readConfig } from './config.js';
import { createApp } from './app.js';

try {
  const config = readConfig();
  const server = createApp(config).listen(config.port, config.host, () => {
    console.log(`BugLens backend listening on port ${config.port} (${config.mode} mode).`);
  });
  server.on('error', () => {
    console.error('Backend could not start. Check the host and port configuration.');
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close());
  }
} catch {
  console.error('Backend configuration is invalid. Check server/.env against .env.example.');
  process.exitCode = 1;
}
