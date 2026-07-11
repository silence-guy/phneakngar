const DEFAULT_PRODUCTION_SITE_URL = "https://phneakngar.ai";
const DEFAULT_LOCAL_SITE_URL = "http://localhost:15210";

export function resolveMetadataBase(
  configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL,
  nodeEnv = process.env.NODE_ENV,
): URL {
  const candidate = configuredSiteUrl?.trim()
    || (nodeEnv === "production" ? DEFAULT_PRODUCTION_SITE_URL : DEFAULT_LOCAL_SITE_URL);
  const url = new URL(candidate);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use http or https");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an origin without a path, query, or fragment");
  }

  return url;
}
