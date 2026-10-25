import { createApp } from "./app.js";
import { ConfigError, loadConfig } from "./config.js";

function start(): void {
  const config = loadConfig(process.env);

  createApp().listen(config.port, (error) => {
    if (error) {
      console.error("ForgeOps API failed to start:", error);
      process.exit(1);
    }
    console.log(`ForgeOps API listening on http://localhost:${config.port}`);
  });
}

try {
  start();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
