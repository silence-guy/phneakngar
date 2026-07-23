import { createLogger } from "../lib/logger.js";
import { ChhlatPushMessageSchema } from "@phneakngar/shared";
const log = createLogger({ module: "ws-client" });
const WS_RECONNECT_INIT = 1000;
const WS_RECONNECT_MAX = 30_000;
const WS_PING_INTERVAL = 25_000;
const WS_LIVENESS_TIMEOUT = 50_000;
const WS_DO_DEV_PORT = Number(process.env.PHNEAKNGAR_WS_DO_PORT) || 8789;
export class ChhlatWsClient {
    opts;
    ws = null;
    reconnectDelay = WS_RECONNECT_INIT;
    reconnectTimer = null;
    pingInterval = null;
    livenessInterval = null;
    lastMessageAt = 0;
    connected = false;
    closed = false;
    constructor(opts) {
        this.opts = opts;
    }
    getUrl(ticket, wsPort = WS_DO_DEV_PORT) {
        const url = new URL(this.opts.serverURL);
        const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
        const query = `ticket=${encodeURIComponent(ticket)}&chhlatId=${encodeURIComponent(this.opts.chhlatId)}`;
        if (isLocal) {
            return `ws://localhost:${wsPort}/?${query}`;
        }
        const protocol = url.protocol === "https:" ? "wss:" : "ws:";
        return `${protocol}//${url.host}/api/ws/chhlat?${query}`;
    }
    isConnected() {
        return this.connected;
    }
    connect() {
        if (this.closed)
            return;
        this.cleanup();
        void this.openWithFreshTicket();
    }
    async openWithFreshTicket() {
        let issued;
        try {
            issued = await this.opts.fetchTicket();
            if (!issued?.ticket)
                throw new Error("missing websocket ticket");
        }
        catch (err) {
            log.warn("ws ticket fetch failed", { err: String(err) });
            this.scheduleReconnect();
            return;
        }
        if (this.closed)
            return;
        const wsUrl = this.getUrl(issued.ticket, issued.wsPort);
        log.info("connecting", { url: wsUrl });
        try {
            this.ws = new WebSocket(wsUrl);
        }
        catch (err) {
            log.warn("ws creation failed", { err: String(err) });
            this.scheduleReconnect();
            return;
        }
        this.ws.addEventListener("open", () => {
            this.reconnectDelay = WS_RECONNECT_INIT;
            this.ws.send(JSON.stringify({
                type: "auth",
                machineToken: this.opts.machineToken,
                chhlatId: this.opts.chhlatId,
                ...(issued.workspaceId ? { workspaceId: issued.workspaceId } : {}),
            }));
            this.lastMessageAt = Date.now();
            this.startHeartbeat();
        });
        this.ws.addEventListener("message", (event) => {
            this.lastMessageAt = Date.now();
            const str = typeof event.data === "string" ? event.data : "";
            if (str === "pong")
                return;
            try {
                const msg = JSON.parse(str);
                if (msg.type === "auth.ok") {
                    log.info("authenticated");
                    this.connected = true;
                    this.opts.onConnected();
                    return;
                }
                const parsed = ChhlatPushMessageSchema.safeParse(msg);
                if (!parsed.success) {
                    log.warn("invalid push message", { err: parsed.error.message });
                    return;
                }
                this.opts.onMessage(parsed.data);
            }
            catch (err) {
                log.debug("message parse error", { err: String(err) });
            }
        });
        this.ws.addEventListener("error", () => {
            log.debug("ws error");
        });
        this.ws.addEventListener("close", () => {
            const wasConnected = this.connected;
            this.connected = false;
            this.stopHeartbeat();
            if (wasConnected) {
                this.opts.onDisconnected();
            }
            if (!this.closed) {
                this.scheduleReconnect();
            }
        });
    }
    close() {
        this.closed = true;
        this.cleanup();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    cleanup() {
        this.stopHeartbeat();
        if (this.ws) {
            try {
                this.ws.close();
            }
            catch { }
            this.ws = null;
        }
        this.connected = false;
    }
    scheduleReconnect() {
        if (this.closed)
            return;
        const delay = Math.min(this.reconnectDelay, WS_RECONNECT_MAX);
        this.reconnectDelay = Math.min(delay * 2, WS_RECONNECT_MAX);
        const jitter = Math.random() * 500;
        log.debug("reconnecting", { delayMs: Math.round(delay + jitter) });
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay + jitter);
    }
    startHeartbeat() {
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send("ping");
            }
        }, WS_PING_INTERVAL);
        this.livenessInterval = setInterval(() => {
            if (Date.now() - this.lastMessageAt > WS_LIVENESS_TIMEOUT) {
                log.warn("liveness timeout, closing");
                this.ws?.close();
            }
        }, 5_000);
    }
    stopHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (this.livenessInterval) {
            clearInterval(this.livenessInterval);
            this.livenessInterval = null;
        }
    }
}
