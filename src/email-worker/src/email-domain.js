import { resolveEmailDomain } from "@phneakngar/shared";
function emailDomainEnvironment(nodeEnv) {
    if (nodeEnv === "development")
        return "development";
    if (nodeEnv === "test")
        return "test";
    return "production";
}
export function resolveEmailWorkerDomain(env) {
    return resolveEmailDomain(env.PHNEAKNGAR_DOMAIN, emailDomainEnvironment(env.NODE_ENV));
}
