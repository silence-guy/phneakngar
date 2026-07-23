/**
 * Minimal HTML → clean markdown (zero external deps).
 * Inspired by agent-oriented extract UX; original implementation.
 */
function decodeEntities(s) {
    return s
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}
function stripTags(html) {
    return decodeEntities(html.replace(/<[^>]+>/g, " "));
}
function collapseWs(s) {
    return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}
/** Extract <title> or first h1. */
export function extractTitle(html) {
    const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (t?.[1]) {
        const title = collapseWs(stripTags(t[1]));
        if (title)
            return title.slice(0, 500);
    }
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1?.[1]) {
        const title = collapseWs(stripTags(h1[1]));
        if (title)
            return title.slice(0, 500);
    }
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    if (og?.[1])
        return collapseWs(decodeEntities(og[1])).slice(0, 500);
    return "";
}
/** Remove scripts, styles, and non-content chrome before body extract. */
export function stripBoilerplate(html) {
    let s = html;
    s = s.replace(/<script\b[\s\S]*?<\/script>/gi, "");
    s = s.replace(/<style\b[\s\S]*?<\/style>/gi, "");
    s = s.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "");
    s = s.replace(/<!--[\s\S]*?-->/g, "");
    s = s.replace(/<svg\b[\s\S]*?<\/svg>/gi, "");
    s = s.replace(/<(header|footer|nav|aside|form)\b[\s\S]*?<\/\1>/gi, "");
    return s;
}
function bodyHtml(html) {
    const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return m?.[1] ?? html;
}
function mainContentHtml(html) {
    const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
    if (article?.[1] && article[1].length > 80)
        return article[1];
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
    if (main?.[1] && main[1].length > 80)
        return main[1];
    return bodyHtml(html);
}
/**
 * Convert a subset of HTML block structure to markdown.
 */
export function htmlToMarkdown(html, maxChars = 30_000) {
    let s = stripBoilerplate(mainContentHtml(html));
    // Headings
    s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => {
        const text = collapseWs(stripTags(inner));
        if (!text)
            return "\n";
        return `\n\n${"#".repeat(Number(level))} ${text}\n\n`;
    });
    // Links
    s = s.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
        const text = collapseWs(stripTags(inner)) || href;
        return `[${text}](${href})`;
    });
    // Images → alt text
    s = s.replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*>/gi, (_, alt) => (alt ? ` ${alt} ` : " "));
    s = s.replace(/<img\b[^>]*>/gi, " ");
    // Lists
    s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
        const text = collapseWs(stripTags(inner));
        return text ? `\n- ${text}` : "";
    });
    // Paragraphs / breaks
    s = s.replace(/<\/p>/gi, "\n\n");
    s = s.replace(/<br\s*\/?>/gi, "\n");
    s = s.replace(/<\/div>/gi, "\n");
    s = s.replace(/<\/tr>/gi, "\n");
    s = s.replace(/<\/(ul|ol|table|section|blockquote)>/gi, "\n\n");
    // Pre / code (keep lightly)
    s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, inner) => {
        const text = decodeEntities(inner.replace(/<[^>]+>/g, ""));
        return `\n\n\`\`\`\n${text.trim()}\n\`\`\`\n\n`;
    });
    s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, inner) => {
        const text = collapseWs(stripTags(inner));
        return text ? `\`${text}\`` : "";
    });
    s = stripTags(s);
    s = collapseWs(s);
    if (s.length > maxChars) {
        // Truncate at paragraph boundary when possible
        let cut = s.slice(0, maxChars);
        const lastBreak = Math.max(cut.lastIndexOf("\n\n"), cut.lastIndexOf("\n"));
        if (lastBreak > maxChars * 0.6)
            cut = cut.slice(0, lastBreak);
        s = `${cut.trimEnd()}\n\n[... content truncated]`;
    }
    return s;
}
export function extractFromHtml(html, maxChars = 30_000) {
    const title = extractTitle(html);
    const markdown = htmlToMarkdown(html, maxChars);
    return { title, markdown, textLength: markdown.length };
}
