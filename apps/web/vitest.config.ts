import { config } from "dotenv"
import { defineConfig } from "vitest/config"

const { parsed } = config({ path: ".env.local", quiet: true })

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    env: parsed ?? {},
    testTimeout: 30_000,
  },
})
