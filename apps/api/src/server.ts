import { createApp } from "./app.js";

// Validated configuration replaces this in ticket 1.3.3.
const port = Number(process.env.PORT ?? 4000);

// Express 5 calls this callback with an error if the server fails to start (e.g. port in use).
createApp().listen(port, (error) => {
  if (error) {
    console.error("ForgeOps API failed to start:", error);
    process.exit(1);
  }
  console.log(`ForgeOps API listening on http://localhost:${port}`);
});
