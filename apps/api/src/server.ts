import { createApp } from "./app.js";
import { loadConfig } from "./config/config.js";
import { createDb } from "./database/client.js";
import { readEncryptionKey } from "./lib/encryption.js";
import { loadGitHubClient } from "./modules/github/github.client.js";

const { port, databaseUrl, production, github, encryptionKeyPath, smtpUrl } = loadConfig(
  process.env,
);

createApp({
  db: createDb(databaseUrl),
  secureCookies: production,
  github: github ? loadGitHubClient(github) : null,
  encryptionKey: readEncryptionKey(encryptionKeyPath),
  emailAlerts: smtpUrl !== null,
}).listen(port, (error) => {
  if (error) throw error;
  console.log(`API listening on http://localhost:${port}`);
});
