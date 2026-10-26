import { useEffect, useState } from "react";
import { checkHealth, type Health } from "./health";

const labels: Record<Health, string> = {
  loading: "Checking...",
  healthy: "API and database healthy",
  "database-down": "API up, database unavailable",
  "api-down": "API unreachable",
};

export function App() {
  const [health, setHealth] = useState<Health>("loading");

  useEffect(() => {
    const update = () => checkHealth().then(setHealth);
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <main>
      <h1>ForgeOps</h1>
      <p role="status">{labels[health]}</p>
    </main>
  );
}
