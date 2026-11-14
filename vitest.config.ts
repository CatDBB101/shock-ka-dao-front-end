// Separate from vite.config.ts: vitest 2 ships its own Vite 5, the tests are pure TS.
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/**/*.test.ts"], environment: "node" } });
