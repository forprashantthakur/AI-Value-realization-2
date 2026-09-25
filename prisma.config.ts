import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma configuration.
 * - Default: classic schema engine (downloaded by the Prisma CLI) — used by `prisma migrate deploy` on Vercel.
 * - PRISMA_SCHEMA_ENGINE=js: uses the bundled WASM/JS schema engine through the pg driver adapter —
 *   useful in locked-down environments where engine binaries cannot be downloaded.
 */
const base = { schema: "prisma/schema.prisma" };

export default process.env.PRISMA_SCHEMA_ENGINE === "js"
  ? defineConfig({
      ...base,
      experimental: { adapter: true },
      engine: "js",
      adapter: async () => new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
  : defineConfig(base);
