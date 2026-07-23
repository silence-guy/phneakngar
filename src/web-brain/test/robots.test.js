import { describe, it, expect } from "vitest";
import { parseRobotsTxt, isPathAllowed, isUrlAllowedByRobots, } from "../src/robots.js";
describe("robots", () => {
    it("parses disallow for *", () => {
        const rules = parseRobotsTxt(`
User-agent: *
Disallow: /private
Allow: /private/public
`);
        expect(isPathAllowed("/ok", rules)).toBe(true);
        expect(isPathAllowed("/private", rules)).toBe(false);
        expect(isPathAllowed("/private/public", rules)).toBe(true);
    });
    it("empty robots allows all", () => {
        const rules = parseRobotsTxt("");
        expect(isUrlAllowedByRobots("https://example.com/any", rules)).toBe(true);
    });
});
