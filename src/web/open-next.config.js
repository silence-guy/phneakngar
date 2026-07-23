import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// R2 incremental cache disabled temporarily: opennext deploy's populateCache
// fails against this account's R2 API (premature close). Worker still runs;
// re-enable when R2 API is stable for this account.
// import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
export default defineCloudflareConfig({
// incrementalCache: r2IncrementalCache,
});
