import { describe, it, expect } from "vitest";
import { assertSafeHttpUrl, assertResolvedAddressesSafe, isBlockedIPv4, isBlockedIPv6, } from "../src/ssrf.js";
describe("SSRF guards", () => {
    it("allows public https URLs", () => {
        const r = assertSafeHttpUrl("https://example.com/path");
        expect(r.ok).toBe(true);
        if (r.ok)
            expect(r.url.hostname).toBe("example.com");
    });
    it("blocks file:// and other schemes", () => {
        const r = assertSafeHttpUrl("file:///etc/passwd");
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.code).toBe("blocked_scheme");
    });
    it("blocks localhost hostnames", () => {
        for (const u of [
            "http://localhost/",
            "http://127.0.0.1/",
            "http://[::1]/",
            "http://169.254.169.254/latest/meta-data/",
            "http://192.168.1.1/",
            "http://10.0.0.5/",
            "http://172.16.0.1/",
        ]) {
            const r = assertSafeHttpUrl(u);
            expect(r.ok, u).toBe(false);
        }
    });
    it("blocks embedded credentials", () => {
        const r = assertSafeHttpUrl("https://user:pass@example.com/");
        expect(r.ok).toBe(false);
    });
    it("isBlockedIPv4 covers private ranges", () => {
        expect(isBlockedIPv4("127.0.0.1")).toBe(true);
        expect(isBlockedIPv4("10.1.2.3")).toBe(true);
        expect(isBlockedIPv4("192.168.0.1")).toBe(true);
        expect(isBlockedIPv4("169.254.169.254")).toBe(true);
        expect(isBlockedIPv4("8.8.8.8")).toBe(false);
    });
    it("isBlockedIPv6 covers loopback and link-local", () => {
        expect(isBlockedIPv6("::1")).toBe(true);
        expect(isBlockedIPv6("fe80::1")).toBe(true);
        expect(isBlockedIPv6("2001:4860:4860::8888")).toBe(false);
    });
    it("assertResolvedAddressesSafe rejects private DNS results", () => {
        const r = assertResolvedAddressesSafe(["127.0.0.1"]);
        expect(r.ok).toBe(false);
    });
    it("allowPrivateNetwork opts out for tests", () => {
        const r = assertSafeHttpUrl("http://127.0.0.1/", { allowPrivateNetwork: true });
        expect(r.ok).toBe(true);
    });
});
