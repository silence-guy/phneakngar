/**
 * Token/char budgets and simple evidence excerpts (no gpt-tokenizer dependency).
 * Approximate tokens ≈ ceil(chars / 4) — within ~15% of cl100k for Latin text.
 */
export const DEFAULT_MAX_TOTAL_CHARS = 100_000;
export const DEFAULT_MAX_TOKENS_OUT = 4_000;
export const PER_PAGE_TOKENS = 2_000;
export const MAX_TOKENS_OUT_CEILING = 60_000;
export const MIN_TOKENS_PER_PAGE = 256;
const TRUNC_MARKER = "\n\n[... content truncated]";
/** Approx token count (cl100k-ish for English). */
export function countTokens(text) {
    if (!text)
        return 0;
    return Math.ceil(text.length / 4);
}
export function truncateByTokens(text, maxTokens) {
    if (maxTokens <= 0)
        return TRUNC_MARKER.trim();
    if (!text)
        return "";
    if (countTokens(text) <= maxTokens)
        return text;
    const maxChars = Math.max(0, maxTokens * 4 - 40);
    const head = text.slice(0, maxChars);
    const threshold = head.length * 0.7;
    const lastSentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf(".\n"), head.lastIndexOf("? "), head.lastIndexOf("! "));
    if (lastSentence > threshold) {
        return head.slice(0, lastSentence + 1) + TRUNC_MARKER;
    }
    const lastPara = head.lastIndexOf("\n\n");
    if (lastPara > threshold)
        return head.slice(0, lastPara) + TRUNC_MARKER;
    return head + TRUNC_MARKER;
}
export function truncateByChars(text, maxChars) {
    if (maxChars <= 0)
        return "";
    if (text.length <= maxChars)
        return text;
    return text.slice(0, Math.max(0, maxChars - 20)) + TRUNC_MARKER;
}
/**
 * Walk items; cap each body against a shared token budget.
 * Optional minTokensPerItem floor so later crawl pages are not emptied.
 */
export function applyAggregateMarkdownBudget(items, getBody, setBody, opts) {
    let used = 0;
    const minFloor = opts.minTokensPerItem ?? 0;
    for (const item of items) {
        const body = getBody(item);
        if (!body)
            continue;
        const remaining = opts.maxTokensOut - used;
        if (remaining <= 0) {
            if (minFloor > 0) {
                setBody(item, truncateByTokens(body, minFloor));
                used += Math.min(minFloor, countTokens(body));
            }
            else {
                setBody(item, "");
            }
            continue;
        }
        const budget = Math.max(remaining, minFloor);
        const next = truncateByTokens(body, budget);
        setBody(item, next);
        used += countTokens(next);
    }
}
/** Cheap evidence: first useful paragraphs (query-agnostic if no match). */
export function buildEvidenceFromMarkdown(query, title, url, markdown, opts = {}) {
    if (!markdown)
        return [];
    const maxItems = opts.maxItems ?? 1;
    const budget = opts.maxTokensOut ?? 400;
    const paras = markdown
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 40);
    const qTokens = query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3);
    const scored = paras.map((p) => {
        const low = p.toLowerCase();
        let score = 0.1;
        for (const t of qTokens)
            if (low.includes(t))
                score += 1;
        return { p, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const out = [];
    let used = 0;
    for (const s of scored.slice(0, maxItems * 2)) {
        if (out.length >= maxItems)
            break;
        const remaining = budget - used;
        if (remaining <= 0)
            break;
        const excerpt = truncateByTokens(s.p, remaining);
        if (excerpt.length < 20)
            continue;
        out.push({ title, url, excerpt, score: s.score });
        used += countTokens(excerpt);
    }
    if (!out.length && paras[0]) {
        out.push({
            title,
            url,
            excerpt: truncateByTokens(paras[0], budget),
            score: 0.1,
        });
    }
    return out;
}
export function scaleDefaultTokens(pageCount) {
    return Math.min(MAX_TOKENS_OUT_CEILING, Math.max(DEFAULT_MAX_TOKENS_OUT, PER_PAGE_TOKENS * Math.max(1, pageCount)));
}
