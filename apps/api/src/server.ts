import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 4000);

createApp().listen(port, (error) => {
  if (error) {
    console.error("ForgeOps API failed to start:", error);
    process.exit(1);
  }
  console.log(`ForgeOps API listening on http://localhost:${port}`);
});
