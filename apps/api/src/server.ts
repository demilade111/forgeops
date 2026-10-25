import express from "express";
import { loadConfig } from "./config.js";

export const app = express();

app.disable("x-powered-by");
app.get("/health/live", (_req, res) => res.json({ status: "ok" }));
app.get("/health/ready", (_req, res) => res.json({ status: "ok" }));

if (import.meta.main) {
  const { port } = loadConfig(process.env);
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`API listening on http://localhost:${port}`);
  });
}
