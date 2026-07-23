import { vi } from "vitest";
// --- DurableObjectState context mock ---
export function createMockCtx() {
    const webSockets = [];
    const acceptWebSocket = vi.fn((ws) => {
        webSockets.push(ws);
    });
    const getWebSockets = vi.fn(() => webSockets);
    const setWebSocketAutoResponse = vi.fn();
    const storageMap = new Map();
    const storage = {
        get: vi.fn((key) => Promise.resolve(storageMap.get(key))),
        put: vi.fn((key, value) => {
            storageMap.set(key, value);
            return Promise.resolve();
        }),
        delete: vi.fn((key) => Promise.resolve(storageMap.delete(key))),
        list: vi.fn((options) => {
            const entries = [...storageMap.entries()]
                .filter(([key]) => !options?.prefix || key.startsWith(options.prefix))
                .slice(0, options?.limit);
            return Promise.resolve(new Map(entries));
        }),
    };
    return {
        ctx: { acceptWebSocket, getWebSockets, setWebSocketAutoResponse, storage },
        acceptWebSocket,
        getWebSockets,
        setWebSocketAutoResponse,
        storage,
        storageMap,
        webSockets,
    };
}
export function createMockWebSocket(readyState = WebSocket.OPEN) {
    let attachment = null;
    const ws = {
        readyState,
        send: vi.fn(),
        close: vi.fn(),
        serializeAttachment: vi.fn((val) => { attachment = val; }),
        deserializeAttachment: vi.fn(() => attachment),
        _attachment: null,
    };
    // Keep _attachment as a getter for test inspection
    Object.defineProperty(ws, "_attachment", { get: () => attachment });
    return ws;
}
// --- WebSocketPair mock ---
export function createMockWebSocketPair() {
    const client = createMockWebSocket();
    const server = createMockWebSocket();
    return { client, server, pair: [client, server] };
}
// --- DurableObjectNamespace / Stub mock ---
export function createMockDONamespace() {
    const stubFetch = vi.fn().mockResolvedValue(new Response("ok"));
    const stub = { fetch: stubFetch };
    const get = vi.fn().mockReturnValue(stub);
    const idFromName = vi.fn().mockReturnValue("mock-do-id");
    return {
        namespace: { idFromName, get },
        idFromName,
        get,
        stub,
        stubFetch,
    };
}
