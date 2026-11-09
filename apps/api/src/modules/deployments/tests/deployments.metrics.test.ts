import { expect, it } from "vitest";
import { parseStats } from "../jobs/deployments.metrics.js";

it("reads docker stats lines into CPU percent and bytes", () => {
  const output = [
    "fo-a1|0.01%|19.26MiB / 3.892GiB",
    "fo-b2|153.20%|512KiB / 1GiB",
    "fo-c3|--|-- / --",
    "forgeops-postgres-1|1.00%|40MiB / 3.892GiB",
    "",
  ].join("\n");

  expect(parseStats(output)).toEqual([
    {
      container: "fo-a1",
      cpuPercent: 0.01,
      memoryBytes: Math.round(19.26 * 1024 ** 2),
      memoryLimit: Math.round(3.892 * 1024 ** 3),
    },
    { container: "fo-b2", cpuPercent: 153.2, memoryBytes: 512 * 1024, memoryLimit: 1024 ** 3 },
  ]);
});
