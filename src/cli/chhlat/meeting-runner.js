import { chromium } from "playwright-core";
import { ensureChrome, joinMeeting, enableCaptions, waitForMeetingReady, buildAloneDetectorScript, isMeetingActive, leaveMeeting, buildCaptionObserverScript, buildCaptionScrapeScript, parseCaptionElements, deduplicateCaptions, formatTranscript, } from "@phneakngar/shared/browser";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import { tempDir } from "../lib/platform.js";
import { createLogger } from "../lib/logger.js";
import { createTimelineEntry, initEntry, updateEntry } from "./execenv/timeline.js";
const log = createLogger({ module: "meeting-runner" });
const SCRAPE_INTERVAL_MS = 3_000;
const DEFAULT_BOT_NAME = "ភ្នាក់ងារ Meeting Bot";
const MAX_RETRY_DURATION_MS = 30 * 60 * 1000;
const RETRY_BACKOFF = [30_000, 60_000, 120_000, 300_000];
const CALLBACK_RETRY_DELAYS_MS = [1_000, 2_000, 5_000];
function isRetryableCallbackStatus(status) {
    return status === 408 || status === 429 || status >= 500;
}
export async function callbackWeb(input, status, transcript, error) {
    const payload = JSON.stringify({
        meetingId: input.meetingId,
        workspaceId: input.workspaceId,
        status,
        transcript: transcript || undefined,
        error: error || undefined,
    });
    for (let attempt = 0; attempt <= CALLBACK_RETRY_DELAYS_MS.length; attempt++) {
        let res;
        try {
            res = await fetch(`${input.callbackUrl}/api/meeting/callback`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${input.authToken}`,
                },
                body: payload,
            });
        }
        catch (err) {
            if (attempt === CALLBACK_RETRY_DELAYS_MS.length) {
                throw err;
            }
            log.warn("callback transport failed, retrying", {
                meeting: input.meetingId,
                attempt: attempt + 1,
            });
            await new Promise((resolveDelay) => setTimeout(resolveDelay, CALLBACK_RETRY_DELAYS_MS[attempt]));
            continue;
        }
        if (res.ok) {
            log.info(`callback ${status} → HTTP ${res.status}`, { meeting: input.meetingId });
            return;
        }
        if (!isRetryableCallbackStatus(res.status) || attempt === CALLBACK_RETRY_DELAYS_MS.length) {
            throw new Error(`callback returned HTTP ${res.status}`);
        }
        log.warn(`callback returned HTTP ${res.status}, retrying`, {
            meeting: input.meetingId,
            attempt: attempt + 1,
        });
        await new Promise((resolveDelay) => setTimeout(resolveDelay, CALLBACK_RETRY_DELAYS_MS[attempt]));
    }
}
function launchBrowser(chromePath) {
    return chromium.launch({
        executablePath: chromePath,
        headless: false,
        args: [
            "--lang=en-US",
            "--disable-blink-features=AutomationControlled",
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--disable-audio-output",
        ],
    });
}
async function tryJoinAndRecord(input, chromePath) {
    const browser = await launchBrowser(chromePath);
    const context = browser.contexts()[0];
    if (context) {
        await context.addInitScript(() => {
            Object.defineProperty(navigator, "webdriver", { get: () => false });
        });
    }
    const page = await browser.newPage({ locale: "en-US" });
    const meetingStartMs = Date.now();
    let transcript = [];
    try {
        const botName = input.agentName ? `${input.agentName} (ភ្នាក់ងារ)` : DEFAULT_BOT_NAME;
        await joinMeeting(page, input.meetingUrl, botName);
        log.info("joined meeting, waiting for UI ready...", { meeting: input.meetingId });
        await waitForMeetingReady(page);
        await page.evaluate(() => {
            for (const btn of document.querySelectorAll('button')) {
                const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                if (label.startsWith('turn off') && (label.includes('microphone') || label.includes('camera'))) {
                    btn.click();
                }
            }
        });
        log.info("meeting ready, enabling captions...", { meeting: input.meetingId });
        await enableCaptions(page);
        await page.evaluate(buildCaptionObserverScript());
        await page.evaluate(buildAloneDetectorScript());
        log.info("captions enabled, scraping loop started", { meeting: input.meetingId });
        let scrapeCount = 0;
        while (true) {
            try {
                const active = await isMeetingActive(page);
                if (!active) {
                    const finalRaw = await page.evaluate(buildCaptionScrapeScript());
                    const finalCaptions = parseCaptionElements(finalRaw);
                    if (finalCaptions.length > 0) {
                        transcript = deduplicateCaptions(transcript, finalCaptions, meetingStartMs, Date.now());
                        log.debug(`final scrape: ${finalCaptions.length} caption(s), total ${transcript.length}`, { meeting: input.meetingId });
                    }
                    log.info("meeting ended (no longer active)", { meeting: input.meetingId });
                    break;
                }
                const rawElements = await page.evaluate(buildCaptionScrapeScript());
                const captions = parseCaptionElements(rawElements);
                scrapeCount++;
                if (captions.length > 0) {
                    const prevLen = transcript.length;
                    transcript = deduplicateCaptions(transcript, captions, meetingStartMs, Date.now());
                    if (transcript.length > prevLen) {
                        log.debug(`caption: ${captions[captions.length - 1].speaker}: "${captions[captions.length - 1].text}" (total ${transcript.length})`, { meeting: input.meetingId });
                    }
                }
                else if (scrapeCount <= 5) {
                    log.debug(`scrape #${scrapeCount}: no captions yet`, { meeting: input.meetingId });
                }
            }
            catch (err) {
                log.error(`scrape error: ${err instanceof Error ? err.message : err}`, { meeting: input.meetingId });
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, SCRAPE_INTERVAL_MS));
        }
        await leaveMeeting(page);
        return { status: "completed", transcript };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Blocked from joining")) {
            const screenshotPath = join(tempDir("phneakngar-meetings"), `meeting-${input.meetingId}-blocked.png`);
            await page.screenshot({ path: screenshotPath }).catch(() => { });
            log.warn(`blocked from joining, screenshot saved: ${screenshotPath}`, { meeting: input.meetingId });
            return { status: "blocked", transcript, error: msg };
        }
        log.error(`unexpected error: ${msg}`, { meeting: input.meetingId });
        return { status: "error", transcript, error: msg };
    }
    finally {
        await page.close().catch(() => { });
        await browser.close().catch(() => { });
    }
}
function writeTimeline(input, status, responses, errmsg) {
    if (!input.timelineDir)
        return;
    try {
        mkdirSync(input.timelineDir, { recursive: true });
        const taskId = `meeting-${input.meetingId}`;
        if (status === "running") {
            const meetingLabel = input.title || input.meetingUrl;
            const entry = createTimelineEntry(taskId, `Meeting: ${meetingLabel} (participants: ${input.participants.join(", ")})`, "meeting", undefined, process.pid);
            initEntry(input.timelineDir, entry);
        }
        else {
            updateEntry(input.timelineDir, taskId, (entry) => {
                entry.status = status;
                entry.pid = null;
                if (responses)
                    entry.agent_responses = responses;
                if (errmsg)
                    entry.errmsg = errmsg;
            });
        }
    }
    catch (err) {
        log.debug(`timeline write failed: ${err instanceof Error ? err.message : err}`);
    }
}
async function run(input) {
    log.info(`starting meeting: url=${input.meetingUrl}`, { meeting: input.meetingId, workspace: input.workspaceId });
    writeTimeline(input, "running");
    let chromePath;
    try {
        chromePath = ensureChrome();
        log.debug(`chrome found: ${chromePath}`);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`chrome setup failed: ${msg}`, { meeting: input.meetingId });
        writeTimeline(input, "failed", undefined, `Chrome setup failed: ${msg}`);
        await callbackWeb(input, "failed", undefined, `Chrome setup failed: ${msg}`);
        process.exit(1);
    }
    const startTime = Date.now();
    let attempt = 0;
    while (true) {
        attempt++;
        log.info(attempt > 1 ? `retry attempt #${attempt}` : "launching browser (en-US, stealth)...", { meeting: input.meetingId });
        const result = await tryJoinAndRecord(input, chromePath);
        if (result.status === "completed") {
            const transcriptText = formatTranscript(result.transcript);
            log.info(`completed: ${result.transcript.length} transcript entries`, { meeting: input.meetingId });
            const transcriptR2Key = `meetings/${input.meetingId}/transcript`;
            writeTimeline(input, "completed", [
                `Meeting completed. ${result.transcript.length} transcript entries captured.`,
                `Transcript stored at: ${transcriptR2Key}`,
            ]);
            await callbackWeb(input, "completed", transcriptText);
            return;
        }
        if (result.status === "blocked") {
            const elapsed = Date.now() - startTime;
            if (elapsed >= MAX_RETRY_DURATION_MS) {
                log.warn(`giving up after ${Math.round(elapsed / 60_000)}min of retries`, { meeting: input.meetingId });
                writeTimeline(input, "failed", undefined, result.error);
                await callbackWeb(input, "failed", undefined, result.error);
                return;
            }
            const backoff = RETRY_BACKOFF[Math.min(attempt - 1, RETRY_BACKOFF.length - 1)];
            log.info(`blocked, retrying in ${backoff / 1000}s (attempt=${attempt}, elapsed=${Math.round(elapsed / 60_000)}min)`, { meeting: input.meetingId });
            await new Promise((resolve) => setTimeout(resolve, backoff));
            continue;
        }
        // Other errors — don't retry
        writeTimeline(input, "failed", undefined, result.error);
        await callbackWeb(input, "failed", undefined, result.error);
        return;
    }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    const encoded = process.argv[2];
    if (!encoded) {
        console.error("Usage: meeting-runner <base64-encoded-input>");
        process.exit(1);
    }
    else {
        const input = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
        run(input).then(() => process.exit(0)).catch((err) => {
            log.error(`fatal: ${err instanceof Error ? err.message : err}`);
            process.exit(1);
        });
    }
}
