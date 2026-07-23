import { spawn } from "child_process";
import { getCurrentVersion } from "./version.js";
export { getCurrentVersion };
const EXACT_SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/;
export function isValidCliVersion(version) {
    return EXACT_SEMVER_RE.test(version);
}
export function fetchLatestVersion() {
    return fetch("https://registry.npmjs.org/@phneakngar/cli/latest")
        .then((res) => {
        if (!res.ok)
            return null;
        return res.json();
    })
        .then((data) => {
        const version = data?.version ?? null;
        return version && isValidCliVersion(version) ? version : null;
    })
        .catch(() => null);
}
export function runNpmUpdate(targetVersion) {
    if (!isValidCliVersion(targetVersion)) {
        return Promise.resolve({ success: false, output: "invalid target version" });
    }
    return new Promise((resolve) => {
        const chunks = [];
        const child = spawn("npm", ["install", "-g", `@phneakngar/cli@${targetVersion}`], {
            stdio: ["ignore", "pipe", "pipe"],
        });
        child.stdout?.on("data", (d) => chunks.push(d));
        child.stderr?.on("data", (d) => chunks.push(d));
        child.on("error", (err) => {
            resolve({ success: false, output: err.message });
        });
        child.on("close", (code) => {
            const output = Buffer.concat(chunks).toString();
            resolve({ success: code === 0, output });
        });
    });
}
