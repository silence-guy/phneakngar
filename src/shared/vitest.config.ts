import { defineConfig, mergeConfig } from "vitest/config"
import shared from "../../vitest.shared"

export default mergeConfig(shared, defineConfig({
  test: {
    // Query/integration fixtures under test/; unit modules co-located in src/
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
  },
}))
