import { createLogger } from "@phneakngar/shared"

export const log = createLogger({
  service: "web",
  level: (process.env.PHNEAKNGAR_LOG_LEVEL as "debug" | "info" | "warn" | "error" | "silent") || "info",
  pretty: process.env.NODE_ENV === "development",
})
