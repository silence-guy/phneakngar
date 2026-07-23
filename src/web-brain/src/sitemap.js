/**
 * Sitemap XML helpers (urlset + sitemapindex + robots Sitemap:).
 * Original lean parser — no external XML deps.
 */
export function extractSitemapUrlFromRobots(robotsTxt) {
    const urls = [];
    for (const line of robotsTxt.split(/\r?\n/)) {
        const m = line.match(/^sitemap:\s*(.+)/i);
        if (m?.[1])
            urls.push(m[1].trim());
    }
    return urls;
}
export function parseSitemapIndex(xml) {
    if (!xml.includes("<sitemapindex"))
        return [];
    const urls = [];
    for (const m of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
        const u = m[1]?.trim();
        if (u)
            urls.push(u);
    }
    return urls;
}
export function parseSitemapEntries(xml) {
    if (xml.includes("<sitemapindex"))
        return [];
    if (!xml.includes("<urlset") && !xml.includes("<loc>"))
        return [];
    const entries = [];
    for (const block of xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)) {
        const body = block[1] ?? "";
        const loc = body.match(/<loc>\s*([^<]+?)\s*<\/loc>/i)?.[1]?.trim();
        if (!loc)
            continue;
        const entry = { url: loc };
        const lastmod = body.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/i)?.[1]?.trim();
        if (lastmod)
            entry.lastmod = lastmod;
        const pr = body.match(/<priority>\s*([^<]+?)\s*<\/priority>/i)?.[1]?.trim();
        if (pr != null) {
            const p = Number.parseFloat(pr);
            if (Number.isFinite(p))
                entry.priority = p;
        }
        entries.push(entry);
    }
    return entries;
}
/** Prefer recent lastmod, then priority, so max_pages keeps fresh content. */
export function sortSitemapEntries(entries) {
    return entries
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => {
        const aLm = a.entry.lastmod ? Date.parse(a.entry.lastmod) : NaN;
        const bLm = b.entry.lastmod ? Date.parse(b.entry.lastmod) : NaN;
        const aOk = Number.isFinite(aLm);
        const bOk = Number.isFinite(bLm);
        if (aOk !== bOk)
            return aOk ? -1 : 1;
        if (aOk && bOk && aLm !== bLm)
            return bLm - aLm;
        const ap = a.entry.priority;
        const bp = b.entry.priority;
        const aHas = typeof ap === "number";
        const bHas = typeof bp === "number";
        if (aHas !== bHas)
            return aHas ? -1 : 1;
        if (aHas && bHas && ap !== bp)
            return bp - ap;
        return a.index - b.index;
    })
        .map((x) => x.entry);
}
const MAX_INDEX_CHILDREN = 5;
/**
 * Discover sorted page URLs from robots + default sitemap paths.
 * Returns [] when nothing usable is found.
 */
export async function discoverSitemapUrls(origin, lightFetch, robotsTxt) {
    const locations = [];
    if (robotsTxt)
        locations.push(...extractSitemapUrlFromRobots(robotsTxt));
    if (locations.length === 0) {
        locations.push(`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`);
    }
    const all = [];
    const seenLoc = new Set();
    async function loadSitemap(url, depth = 0) {
        if (seenLoc.has(url) || depth > 2)
            return;
        seenLoc.add(url);
        const res = await lightFetch(url);
        if (!res.ok || res.status >= 400 || !res.body)
            return;
        const xml = res.body;
        if (xml.includes("<sitemapindex")) {
            for (const child of parseSitemapIndex(xml).slice(0, MAX_INDEX_CHILDREN)) {
                await loadSitemap(child, depth + 1);
            }
            return;
        }
        all.push(...parseSitemapEntries(xml));
    }
    for (const loc of locations) {
        await loadSitemap(loc);
    }
    return sortSitemapEntries(all).map((e) => e.url);
}
