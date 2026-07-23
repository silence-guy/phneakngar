import { nanoid } from "nanoid";
import PostalMime from "postal-mime";
import { createDb, queries, parseEmailHandle, toPhneakngarAddress, getEmailDomain, createLogger, buildMimeMessage, extractAttachmentMeta, isEmailDraftAttachmentKeyForScope, EMAIL_NOTIFY_SECRET_HEADER, EMAIL_DOMAIN_EXPECTATION_HEADER, OutboundEmailDeliveryStatus } from "@phneakngar/shared";
import { decrypt } from "@phneakngar/shared/crypto";
import { safeEqualSecret } from "@phneakngar/shared/secrets";
import { WorkerMailer } from "worker-mailer";
import { EmailMessage } from "cloudflare:email";
const SMTP_AUTH_TYPES = ["plain", "login", "cram-md5"];
const MAX_INBOUND_EMAIL_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 10;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
import { resolveEmailWorkerDomain } from "./email-domain";
export { ImapPollerDO } from "./imap-poller-do";
const log = createLogger({ service: "email" });
async function sha256Hex(buffer) {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
async function notifyWeb(env, payload, traceId) {
    const body = JSON.stringify(payload);
    const headers = {
        "Content-Type": "application/json",
        "X-Trace-Id": traceId,
        [EMAIL_NOTIFY_SECRET_HEADER]: env.EMAIL_NOTIFY_SECRET,
    };
    const init = { method: "POST", headers, body };
    if (env.WEB_SERVICE) {
        const res = await env.WEB_SERVICE.fetch("http://internal/api/email/notify", init);
        if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            throw new Error(`WEB_SERVICE responded ${res.status}: ${errBody}`);
        }
        return;
    }
    const webOrigin = env.WEB_ORIGIN?.trim();
    if (!webOrigin)
        throw new Error("WEB_ORIGIN is not configured");
    const response = await fetch(new URL("/api/email/notify", webOrigin), init);
    if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        throw new Error(`web notify responded ${response.status}: ${errBody}`);
    }
}
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === "/health" && request.method === "GET") {
            try {
                const emailDomain = resolveEmailWorkerDomain(env);
                const expectedDomain = request.headers.get(EMAIL_DOMAIN_EXPECTATION_HEADER);
                if (expectedDomain !== null && getEmailDomain(expectedDomain) !== emailDomain) {
                    throw new Error("Email domain configuration mismatch");
                }
                return Response.json({ status: "ok" });
            }
            catch {
                return Response.json({ status: "degraded" }, { status: 503 });
            }
        }
        let emailDomain;
        try {
            emailDomain = resolveEmailWorkerDomain(env);
        }
        catch {
            return Response.json({ error: "email service is not configured" }, { status: 503 });
        }
        if (!env.EMAIL_NOTIFY_SECRET) {
            return Response.json({ error: "internal authentication is not configured" }, { status: 503 });
        }
        if (!safeEqualSecret(request.headers.get(EMAIL_NOTIFY_SECRET_HEADER), env.EMAIL_NOTIFY_SECRET)) {
            return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        if (url.pathname.startsWith("/imap/")) {
            return this.handleImap(request, env, url);
        }
        if (request.method !== "POST") {
            return Response.json({ error: "method not allowed" }, { status: 405 });
        }
        if (url.pathname === "/send/otp") {
            return this.handleSendOtp(request, env, emailDomain);
        }
        if (url.pathname === "/send/agent") {
            return this.handleSendAgent(request, env, emailDomain);
        }
        return Response.json({ error: "not found" }, { status: 404 });
    },
    async handleSendOtp(request, env, emailDomain) {
        const body = await request.json();
        if (!body.to || !body.subject) {
            return Response.json({ error: "to and subject are required" }, { status: 400 });
        }
        const from = toPhneakngarAddress("no-reply", emailDomain);
        try {
            await env.SEND_EMAIL.send({
                from,
                to: body.to,
                subject: body.subject,
                html: body.html ?? "",
                text: body.html ? undefined : body.subject,
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
            log.error("OTP SEND_EMAIL failed", { error: msg, code, from, to: body.to });
            return Response.json({ error: `email send failed: ${code || msg}` }, { status: 502 });
        }
        return Response.json({ ok: true, from });
    },
    async handleSendAgent(request, env, emailDomain) {
        const body = await request.json();
        const preSendError = (error, status) => Response.json({ error, phase: "pre_send" }, { status });
        const sendError = (error, status) => Response.json({ error, phase: "send" }, { status });
        if (!body.agentId || !body.workspaceId || !body.to || !body.subject) {
            return preSendError("agentId, workspaceId, to, and subject are required", 400);
        }
        const db = createDb(env.DB);
        const agent = await queries.agent.getAgent(db, body.agentId, body.workspaceId);
        if (!agent) {
            return preSendError("agent not found in workspace", 404);
        }
        // Defense in depth: if web passed emailId, require claim status === sending.
        // Legacy callers without emailId (or blank/non-string) keep working (status gate skipped).
        const emailId = typeof body.emailId === "string" ? body.emailId.trim() : "";
        if (emailId) {
            const claim = await queries.email.getEmailById(db, emailId, body.workspaceId);
            if (!claim) {
                return preSendError("outbound email claim not found", 404);
            }
            if (claim.agentId !== body.agentId) {
                return preSendError("outbound email claim agent mismatch", 403);
            }
            // Anything other than `sending` is not sendable (pending_approval, pending,
            // rejected, failed, sent, ambiguous, empty, etc.).
            const status = (claim.status ?? "").trim();
            if (status !== OutboundEmailDeliveryStatus.SENDING) {
                return preSendError(`outbound email claim not sendable (status=${status || "unknown"})`, 409);
            }
        }
        let fromAddress;
        let useCustomSmtp = false;
        let customAccount = null;
        if (body.customAccountId) {
            customAccount = await queries.emailAccount.getEmailAccount(db, body.customAccountId, body.workspaceId);
            if (!customAccount) {
                return preSendError("custom email account not found", 404);
            }
            fromAddress = customAccount.displayName
                ? `${customAccount.displayName} <${customAccount.emailAddress}>`
                : customAccount.emailAddress;
            useCustomSmtp = true;
        }
        else {
            if (!agent.emailHandle) {
                return preSendError("agent has no email handle configured", 400);
            }
            fromAddress = toPhneakngarAddress(agent.emailHandle, emailDomain);
        }
        const htmlBody = body.htmlBody ?? "";
        const attachmentKeys = body.attachmentKeys ?? [];
        if (attachmentKeys.length > MAX_ATTACHMENT_COUNT) {
            return preSendError(`at most ${MAX_ATTACHMENT_COUNT} attachments are allowed`, 413);
        }
        for (const attachment of attachmentKeys) {
            if (!isEmailDraftAttachmentKeyForScope(attachment.key, body.workspaceId)) {
                return preSendError("invalid attachment key", 400);
            }
        }
        // Read sequentially so the aggregate byte limit is deterministic and Worker
        // memory does not spike from multiple simultaneous ArrayBuffer allocations.
        let totalAttachmentBytes = 0;
        const attachments = [];
        for (const att of attachmentKeys) {
            const obj = await env.EMAIL_BUCKET.get(att.key);
            if (!obj)
                continue;
            if (obj.size > MAX_ATTACHMENT_BYTES) {
                return preSendError("attachment is too large", 413);
            }
            totalAttachmentBytes += obj.size;
            if (totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
                return preSendError("attachments are too large in total", 413);
            }
            const raw = await obj.arrayBuffer();
            attachments.push({
                disposition: "attachment",
                filename: att.filename,
                type: att.contentType,
                raw,
                base64: arrayBufferToBase64(raw),
            });
        }
        // Prefer caller-provided durable identities (web claim). Otherwise generate once.
        // Domain must match the sending path: PHNEAKNGAR_DOMAIN for CF Email Service, or
        // the custom SMTP account domain.
        const fromDomain = useCustomSmtp && customAccount
            ? customAccount.emailAddress.split("@").pop()
            : emailDomain;
        const outMessageId = body.messageId?.trim()
            ? body.messageId.trim()
            : `<${nanoid()}@${fromDomain}>`;
        const r2Key = body.r2Key?.trim()
            ? body.r2Key.trim()
            : `emails/${nanoid()}/raw`;
        // Build the raw MIME once — used both as the wire message (CF path) and as the
        // R2 archive (both paths). buildMimeMessage emits From + Message-ID + threading
        // headers, so the archived copy always matches what was transmitted.
        const rawMime = buildMimeMessage({
            from: fromAddress,
            to: body.to,
            subject: body.subject,
            messageId: outMessageId,
            inReplyTo: body.inReplyTo,
            references: body.references,
            body: htmlBody,
            bodyType: "text/html",
            attachments: attachments.map(a => ({ filename: a.filename, contentType: a.type, base64: a.base64 })),
        });
        // Archive before external send so retries with the same claim overwrite the same key
        // and wire/archive Message-ID stay identical even if the provider call fails.
        try {
            await env.EMAIL_BUCKET.put(r2Key, rawMime, {
                httpMetadata: { contentType: "message/rfc822" },
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error("R2 archive before send failed", { error: msg, r2Key });
            return preSendError(`R2 archive failed: ${msg}`, 500);
        }
        if (useCustomSmtp && customAccount) {
            const secret = env.ENCRYPTION_KEY;
            if (!secret) {
                return preSendError("encryption key not configured", 500);
            }
            let smtpUsername;
            let smtpPassword;
            try {
                smtpUsername = decrypt(customAccount.smtpUsername, secret);
                smtpPassword = decrypt(customAccount.smtpPassword, secret);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return preSendError(`SMTP credential decrypt failed: ${msg}`, 500);
            }
            const smtpTls = customAccount.smtpTls;
            // Control the wire Message-ID so it equals the registered/archived id.
            // WorkerMailer respects a provided Message-ID and only auto-generates if absent.
            const threadingHeaders = { "Message-ID": outMessageId };
            if (body.inReplyTo)
                threadingHeaders["In-Reply-To"] = body.inReplyTo;
            if (body.references)
                threadingHeaders["References"] = body.references;
            try {
                await WorkerMailer.send({
                    host: customAccount.smtpHost,
                    port: customAccount.smtpPort,
                    secure: smtpTls === 2,
                    startTls: smtpTls === 1,
                    authType: SMTP_AUTH_TYPES,
                    credentials: { username: smtpUsername, password: smtpPassword },
                }, {
                    from: customAccount.displayName
                        ? { name: customAccount.displayName, email: customAccount.emailAddress }
                        : customAccount.emailAddress,
                    to: body.to,
                    subject: body.subject,
                    html: htmlBody,
                    headers: threadingHeaders,
                    attachments: attachments.map(a => ({
                        filename: a.filename,
                        content: a.base64,
                        mimeType: a.type,
                    })),
                });
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                log.error("custom SMTP send failed", { error: msg, accountId: body.customAccountId });
                // Provider attempt started — outcome may be unknown to the client.
                return sendError(`SMTP send failed: ${msg}`, 500);
            }
        }
        else {
            // Send the raw MIME so the wire Message-ID (and threading headers) are the ones
            // we control. The CF structured builder has no reliable Message-ID field — its
            // MTA assigns its own — so we use the raw-MIME overload instead.
            try {
                await env.SEND_EMAIL.send(new EmailMessage(fromAddress, body.to, rawMime));
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                log.error("CF SEND_EMAIL failed", { error: msg, from: fromAddress, to: body.to });
                return sendError(`email send failed: ${msg}`, 502);
            }
        }
        return Response.json({ ok: true, r2Key, messageId: outMessageId });
    },
    async handleImap(request, env, url) {
        const accountId = url.searchParams.get("accountId");
        if (!accountId) {
            return Response.json({ error: "accountId query parameter required" }, { status: 400 });
        }
        const workspaceId = url.searchParams.get("workspaceId");
        if (!workspaceId) {
            return Response.json({ error: "workspaceId query parameter required" }, { status: 400 });
        }
        const doId = env.IMAP_POLLER.idFromName(accountId);
        const stub = env.IMAP_POLLER.get(doId);
        const action = url.pathname.replace("/imap/", "");
        const internalUrl = `http://internal/${action}?workspaceId=${encodeURIComponent(workspaceId)}`;
        if (action === "start" && request.method === "POST") {
            return stub.fetch(new Request(internalUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accountId, workspaceId }),
            }));
        }
        if (action === "stop" && request.method === "POST") {
            return stub.fetch(new Request(internalUrl, { method: "POST" }));
        }
        if (action === "sync" && request.method === "POST") {
            return stub.fetch(new Request(internalUrl, { method: "POST" }));
        }
        if (action === "status" && request.method === "GET") {
            return stub.fetch(new Request(internalUrl, { method: "GET" }));
        }
        if (action === "test" && request.method === "POST") {
            return this.handleTestConnection(accountId, env, workspaceId);
        }
        return Response.json({ error: "not found" }, { status: 404 });
    },
    async handleTestConnection(accountId, env, workspaceId) {
        const db = createDb(env.DB);
        const account = await queries.emailAccount.getEmailAccountById(db, accountId, workspaceId);
        if (!account) {
            return Response.json({ error: "account not found" }, { status: 404 });
        }
        const secret = env.ENCRYPTION_KEY;
        if (!secret) {
            return Response.json({ error: "encryption key not configured" }, { status: 500 });
        }
        const result = { imap: "untested", smtp: "untested" };
        try {
            const { ImapClient } = await import("./lib/imap-client");
            const imapClient = new ImapClient({
                host: account.imapHost,
                port: account.imapPort,
                tls: account.imapTls,
                auth: {
                    username: decrypt(account.imapUsername, secret),
                    password: decrypt(account.imapPassword, secret),
                },
            });
            await imapClient.connect();
            await imapClient.logout();
            result.imap = "ok";
        }
        catch (err) {
            result.imap = `error: ${err instanceof Error ? err.message : String(err)}`;
        }
        try {
            const smtpUsername = decrypt(account.smtpUsername, secret);
            const smtpPassword = decrypt(account.smtpPassword, secret);
            const smtpTls = account.smtpTls;
            const mailer = await WorkerMailer.connect({
                host: account.smtpHost,
                port: account.smtpPort,
                secure: smtpTls === 2,
                startTls: smtpTls === 1,
                authType: SMTP_AUTH_TYPES,
                credentials: { username: smtpUsername, password: smtpPassword },
            });
            await mailer.close();
            result.smtp = "ok";
        }
        catch (err) {
            result.smtp = `error: ${err instanceof Error ? err.message : String(err)}`;
        }
        const allOk = result.imap === "ok" && result.smtp === "ok";
        return Response.json(result, { status: allOk ? 200 : 422 });
    },
    async email(message, env) {
        if (message.rawSize > MAX_INBOUND_EMAIL_BYTES) {
            message.setReject("Message exceeds the maximum accepted size");
            return;
        }
        const traceId = nanoid(12);
        const emailLog = log.child({ traceId, from: message.from, to: message.to });
        let emailDomain;
        try {
            emailDomain = resolveEmailWorkerDomain(env);
        }
        catch {
            message.setReject("Email service is not configured");
            return;
        }
        const db = createDb(env.DB);
        const handle = parseEmailHandle(message.to, emailDomain);
        const agent = await queries.agent.getAgentByHandle(db, handle);
        if (!agent) {
            emailLog.warn("no agent found", { handle });
            message.setReject("No agent found for this address");
            return;
        }
        emailLog.info("email received", { agentId: agent.id, handle });
        const whitelisted = await queries.whitelist.isWhitelisted(db, agent.id, agent.workspaceId, message.from, emailDomain);
        const rawBytes = await new Response(message.raw).arrayBuffer();
        const rawDigest = await sha256Hex(rawBytes);
        const deliveryKey = `cf:${agent.id}:${rawDigest}`;
        const r2Key = `emails/inbound/${agent.workspaceId}/${agent.id}/${rawDigest}/raw`;
        await env.EMAIL_BUCKET.put(r2Key, rawBytes, {
            httpMetadata: { contentType: "message/rfc822" },
        });
        const parsed = await PostalMime.parse(rawBytes);
        const attachmentsMeta = extractAttachmentMeta(parsed.attachments || []);
        const subject = parsed.subject || message.headers.get("subject") || "(No Subject)";
        const messageId = message.headers.get("message-id") ?? "";
        const inReplyTo = message.headers.get("in-reply-to") ?? "";
        const references = message.headers.get("references") ?? "";
        const threadingFields = { messageId, deliveryKey, inReplyTo, references };
        const attachmentsField = attachmentsMeta.length > 0 ? { attachments: JSON.stringify(attachmentsMeta) } : {};
        if (whitelisted) {
            emailLog.info("whitelisted email, notifying web", { agentId: agent.id });
            await notifyWeb(env, {
                agentId: agent.id,
                workspaceId: agent.workspaceId,
                r2Key,
                from: message.from,
                to: message.to,
                subject,
                isWhitelisted: true,
                ...threadingFields,
                ...attachmentsField,
            }, traceId);
        }
        else {
            emailLog.info("non-whitelisted email, rejecting", { agentId: agent.id });
            await notifyWeb(env, {
                agentId: agent.id,
                workspaceId: agent.workspaceId,
                r2Key,
                from: message.from,
                to: message.to,
                subject,
                isWhitelisted: false,
                forwarded: false,
                ...threadingFields,
                ...attachmentsField,
            }, traceId);
            message.setReject("Sender not whitelisted");
        }
    },
};
