import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChhlatWsClient } from "./ws-client.js";

class MockWebSocket extends EventTarget {
  static OPEN = 1;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  url: string;
  send = vi.fn();

  constructor(url: string) {
    super();
    this.url = url;
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }

  simulateOpen() {
    this.dispatchEvent(new Event("open"));
  }

  simulateMessage(data: string) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }
}

function makeClient(overrides: Partial<ConstructorParameters<typeof ChhlatWsClient>[0]> = {}) {
  return new ChhlatWsClient({
    serverURL: "https://phneakngar.ai",
    chhlatId: "my-host",
    machineToken: "al_test123",
    fetchTicket: vi.fn().mockResolvedValue({ ticket: "ticket-1", workspaceId: "workspace-1" }),
    onMessage: vi.fn(),
    onConnected: vi.fn(),
    onDisconnected: vi.fn(),
    ...overrides,
  });
}

describe("ChhlatWsClient", () => {
  let originalWebSocket: typeof globalThis.WebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    originalWebSocket = globalThis.WebSocket;
    (globalThis as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.WebSocket = originalWebSocket;
  });

  it("constructs production URL correctly", () => {
    const client = makeClient();
    expect(client.getUrl("ticket-1")).toBe("wss://phneakngar.ai/api/ws/chhlat?ticket=ticket-1&chhlatId=my-host");
  });

  it("constructs local development URL correctly", () => {
    const client = makeClient({ serverURL: "http://localhost:3000" });
    expect(client.getUrl("ticket-1")).toBe("ws://localhost:8789/?ticket=ticket-1&chhlatId=my-host");
  });

  it("reports disconnected initially", () => {
    const client = makeClient();
    expect(client.isConnected()).toBe(false);
  });

  it("sends auth message on open", async () => {
    const client = makeClient();
    client.connect();
    await vi.runAllTimersAsync();

    const ws = (client as any).ws as MockWebSocket;
    ws.simulateOpen();

    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({
      type: "auth",
      machineToken: "al_test123",
      chhlatId: "my-host",
      workspaceId: "workspace-1",
    }));
  });

  it("sets connected=true and calls onConnected after auth.ok", async () => {
    const onConnected = vi.fn();
    const client = makeClient({ onConnected });
    client.connect();
    await vi.runAllTimersAsync();

    const ws = (client as any).ws as MockWebSocket;
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({ type: "auth.ok" }));

    expect(client.isConnected()).toBe(true);
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it("validates messages with ChhlatPushMessageSchema — valid message calls onMessage", async () => {
    const onMessage = vi.fn();
    const client = makeClient({ onMessage });
    client.connect();
    await vi.runAllTimersAsync();

    const ws = (client as any).ws as MockWebSocket;
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({ type: "auth.ok" }));
    ws.simulateMessage(JSON.stringify({ type: "chhlat.rescan" }));

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({ type: "chhlat.rescan" });
  });

  it("invalid message (bad schema) does not call onMessage", async () => {
    const onMessage = vi.fn();
    const client = makeClient({ onMessage });
    client.connect();
    await vi.runAllTimersAsync();

    const ws = (client as any).ws as MockWebSocket;
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({ type: "auth.ok" }));
    ws.simulateMessage(JSON.stringify({ type: "unknown.garbage", foo: "bar" }));

    expect(onMessage).not.toHaveBeenCalled();
  });

  it("schedules reconnect on close (verify reconnectTimer is set)", async () => {
    const client = makeClient();
    client.connect();
    await vi.runAllTimersAsync();

    const ws = (client as any).ws as MockWebSocket;
    ws.simulateOpen();
    ws.simulateClose();

    expect((client as any).reconnectTimer).not.toBeNull();
  });

  it("does not reconnect after close() is called", async () => {
    const client = makeClient();
    client.connect();
    await vi.runAllTimersAsync();

    const ws = (client as any).ws as MockWebSocket;
    ws.simulateOpen();

    client.close();

    expect((client as any).reconnectTimer).toBeNull();
    expect((client as any).closed).toBe(true);
  });

  it("liveness timeout triggers ws.close() if no messages received", async () => {
    const client = makeClient();
    client.connect();
    await vi.runAllTimersAsync();

    const ws = (client as any).ws as MockWebSocket;
    ws.simulateOpen();

    const closeSpy = vi.spyOn(ws, "close");
    vi.advanceTimersByTime(55_000);

    expect(closeSpy).toHaveBeenCalled();
  });

  it("calls onDisconnected when connection drops after being authenticated", async () => {
    const onDisconnected = vi.fn();
    const client = makeClient({ onDisconnected });
    client.connect();
    await vi.runAllTimersAsync();

    const ws = (client as any).ws as MockWebSocket;
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({ type: "auth.ok" }));

    expect(client.isConnected()).toBe(true);
    ws.simulateClose();

    expect(onDisconnected).toHaveBeenCalledTimes(1);
    expect(client.isConnected()).toBe(false);
  });

  it("fetches a fresh ticket for reconnects", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const fetchTicket = vi.fn()
      .mockResolvedValueOnce({ ticket: "ticket-1", workspaceId: "workspace-1" })
      .mockResolvedValueOnce({ ticket: "ticket-2", workspaceId: "workspace-1" });
    try {
      const client = makeClient({ fetchTicket });
      client.connect();
      await Promise.resolve();
      const firstWs = (client as any).ws as MockWebSocket;

      expect(firstWs.url).toContain("ticket=ticket-1");
      expect(firstWs.url).not.toContain("al_test123");

      firstWs.simulateClose();
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();

      expect(fetchTicket).toHaveBeenCalledTimes(2);
      expect(((client as any).ws as MockWebSocket).url).toContain("ticket=ticket-2");
      expect(((client as any).ws as MockWebSocket).url).not.toContain("ticket=ticket-1");
    } finally {
      randomSpy.mockRestore();
    }
  });
});
