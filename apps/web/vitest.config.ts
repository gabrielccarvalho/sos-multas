import { config } from "dotenv"
import { defineConfig } from "vitest/config"

const { parsed } = config({ path: ".env.local", quiet: true })

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["lib/**/*.test.ts"],
    env: parsed ?? {},
    testTimeout: 30_000,
  },
})
