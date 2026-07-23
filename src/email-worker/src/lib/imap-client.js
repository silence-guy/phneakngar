import { connect } from "cloudflare:sockets";
export class ImapError extends Error {
    constructor(message) {
        super(message);
        this.name = "ImapError";
    }
}
export class ImapAuthError extends ImapError {
    permanent;
    constructor(message, permanent = false) {
        super(message);
        this.name = "ImapAuthError";
        this.permanent = permanent;
    }
}
const DEFAULT_READ_TIMEOUT_MS = 15_000;
export class ImapClient {
    options;
    socket = null;
    writer = null;
    reader = null;
    encoder = new TextEncoder();
    tagCounter = 0;
    readTimeoutMs;
    constructor(options) {
        this.options = options;
        this.readTimeoutMs = options.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS;
    }
    async connect() {
        const opts = { allowHalfOpen: true };
        if (this.options.tls)
            opts.secureTransport = "starttls";
        this.socket = connect({ hostname: this.options.host, port: this.options.port }, opts);
        if (this.options.tls) {
            this.socket = this.socket.startTls();
        }
        this.writer = this.socket.writable.getWriter();
        this.reader = this.socket.readable.getReader();
        await this.readGreeting();
        const tag = this.nextTag();
        const user = this.quote(this.options.auth.username);
        const pass = this.quote(this.options.auth.password);
        try {
            await this.sendCommand(tag, `LOGIN ${user} ${pass}`);
        }
        catch (err) {
            if (err instanceof ImapError) {
                const upper = err.message.toUpperCase();
                const permanent = upper.includes("[AUTHENTICATIONFAILED]") || upper.includes("INVALID CREDENTIALS");
                throw new ImapAuthError(err.message, permanent);
            }
            throw err;
        }
    }
    async select(folder) {
        const tag = this.nextTag();
        const resp = await this.sendCommand(tag, `SELECT ${this.quote(folder)}`);
        const existsMatch = resp.match(/\* (\d+) EXISTS/);
        return { exists: existsMatch ? parseInt(existsMatch[1], 10) : 0 };
    }
    async command(tag, cmd) {
        return this.sendCommand(tag, cmd);
    }
    async logout() {
        try {
            const tag = this.nextTag();
            await this.writer?.write(this.encoder.encode(`${tag} LOGOUT\r\n`));
        }
        catch { /* best-effort */ }
        await this.close();
    }
    async close() {
        try {
            this.reader?.releaseLock();
        }
        catch { /* ignore */ }
        try {
            this.writer?.releaseLock();
        }
        catch { /* ignore */ }
        try {
            await this.socket?.close();
        }
        catch { /* ignore */ }
        this.socket = null;
        this.writer = null;
        this.reader = null;
    }
    nextTag() {
        return `A${++this.tagCounter}`;
    }
    async sendCommand(tag, cmd) {
        if (!this.writer || !this.reader)
            throw new ImapError("Not connected");
        await this.writer.write(this.encoder.encode(`${tag} ${cmd}\r\n`));
        return this.readUntilTag(tag);
    }
    async readGreeting() {
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
            const chunk = await this.timedRead();
            if (chunk.done)
                throw new ImapError("Connection closed before greeting");
            buf += decoder.decode(chunk.value, { stream: true });
            if (buf.split("\r\n").some(l => l.startsWith("* OK")))
                return;
            if (buf.split("\r\n").some(l => l.startsWith("* BYE"))) {
                throw new ImapError(`Server rejected connection: ${buf.trim()}`);
            }
        }
    }
    async readUntilTag(tag) {
        if (!this.reader)
            throw new ImapError("Not connected");
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
            const chunk = await this.timedRead();
            if (chunk.done)
                break;
            buf += decoder.decode(chunk.value, { stream: true });
            for (const line of buf.split("\r\n")) {
                if (line.startsWith(`${tag} OK`))
                    return buf;
                if (line.startsWith(`${tag} NO`) || line.startsWith(`${tag} BAD`)) {
                    throw new ImapError(`IMAP ${tag} failed: ${line}`);
                }
            }
        }
        throw new ImapError(`IMAP stream ended without tagged response for ${tag}`);
    }
    async timedRead() {
        if (!this.reader)
            throw new ImapError("Not connected");
        return Promise.race([
            this.reader.read(),
            new Promise((_, reject) => setTimeout(() => reject(new ImapError("IMAP read timeout")), this.readTimeoutMs)),
        ]);
    }
    quote(s) {
        return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
}
