import { afterAll } from "vitest"
import { closeDb } from "@phneakngar/test-utils"

afterAll(() => {
  closeDb()
})
