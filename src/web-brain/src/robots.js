/**
 * Minimal robots.txt parser + allow check (zero deps).
 */
const DEFAULT_UA = "phneakngar-web-brain";
export function parseRobotsTxt(text, userAgent = DEFAULT_UA) {
    const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
    const groups = [];
    let current = null;
    const flush = () => {
        if (current && current.agents.length)
            groups.push(current);
        current = null;
    };
    for (const line of lines) {
        if (!line)
            continue;
        const idx = line.indexOf(":");
        if (idx < 0)
            continue;
        const key = line.slice(0, idx).trim().toLowerCase();
        const value = line.slice(idx + 1).trim();
        if (key === "user-agent") {
            if (!current || current.disallows.length || current.allows.length) {
                flush();
                current = { agents: [value.toLowerCase()], disallows: [], allows: [], delay: null };
            }
            else {
                current.agents.push(value.toLowerCase());
            }
        }
        else if (current) {
            if (key === "disallow")
                current.disallows.push(value);
            else if (key === "allow")
                current.allows.push(value);
            else if (key === "crawl-delay") {
                const n = Number(value);
                if (Number.isFinite(n) && n >= 0)
                    current.delay = Math.round(n * 1000);
            }
        }
    }
    flush();
    const ua = userAgent.toLowerCase();
    const match = groups.find((g) => g.agents.some((a) => a !== "*" && (ua === a || ua.startsWith(a)))) ||
        groups.find((g) => g.agents.includes("*")) ||
        null;
    if (!match) {
        return { disallows: [], allows: [], crawlDelayMs: null };
    }
    return {
        disallows: match.disallows.filter((p) => p.length > 0),
        allows: match.allows.filter((p) => p.length > 0),
        crawlDelayMs: match.delay,
    };
}
/** True if path is allowed by robots rules. Empty disallow = allow all. */
export function isPathAllowed(pathname, rules) {
    const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
    let bestAllow = -1;
    for (const a of rules.allows) {
        if (path.startsWith(a) && a.length > bestAllow)
            bestAllow = a.length;
    }
    let bestDisallow = -1;
    for (const d of rules.disallows) {
        if (d === "")
            continue; // empty disallow means allow all for that agent in some crawlers
        if (path.startsWith(d) && d.length > bestDisallow)
            bestDisallow = d.length;
    }
    if (bestDisallow < 0)
        return true;
    if (bestAllow > bestDisallow)
        return true;
    return false;
}
export function isUrlAllowedByRobots(url, rules) {
    try {
        const u = new URL(url);
        return isPathAllowed(u.pathname || "/", rules);
    }
    catch {
        return false;
    }
}
