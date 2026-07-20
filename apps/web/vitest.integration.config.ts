import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Integration tests run against the real Firestore emulator — Google's actual
 * Firestore engine on localhost, not a mock. Start it first:
 *
 *   npm run emulator      (in one terminal)
 *   npm run test:integration
 *
 * Node environment (no jsdom), single-threaded so tests do not race on shared
 * collections, and a longer timeout for the network hop to the emulator.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.integration.test.ts"],
    exclude: ["node_modules", ".next"],
    setupFiles: ["./vitest.integration.setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
