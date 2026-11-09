import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node", include: ["src/**/*.test.ts"], server: { deps: { inline: [] } } },
  ssr: { resolve: { conditions: ["react-server"] } },
});
