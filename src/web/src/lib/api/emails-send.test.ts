import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApiFetch = vi.fn();

vi.mock("./client", () => ({
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
  wsQuery: (workspaceId: string) => `?workspace_id=${workspaceId}`,
}));

import { isSendEmailPendingApproval, sendEmail } from "./emails";

describe("sendEmail requiresApproval wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockResolvedValue({ id: "e1" });
  });

  it("passes requiresApproval true when options set", async () => {
    await sendEmail("ag1", "a@b.com", "Hi", "<p>x</p>", "ws1", {
      requiresApproval: true,
    });
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/email/send"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"requiresApproval":true'),
      }),
    );
  });

  it("omits requiresApproval when not set (legacy attachments array)", async () => {
    await sendEmail("ag1", "a@b.com", "Hi", "<p>x</p>", "ws1", [
      { key: "k", filename: "f.txt", size: 1, contentType: "text/plain" },
    ]);
    const body = JSON.parse(mockApiFetch.mock.calls[0][1].body as string);
    expect(body).not.toHaveProperty("requiresApproval");
    expect(body.attachments).toHaveLength(1);
  });

  it("recognizes pending-approval envelope from 202 send", async () => {
    mockApiFetch.mockResolvedValueOnce({
      status: "pending_approval",
      email: { id: "e9", to_email: "a@b.com" },
      approval: { id: "ap_9" },
    });
    const result = await sendEmail("ag1", "a@b.com", "Hi", "<p>x</p>", "ws1", {
      requiresApproval: true,
    });
    expect(isSendEmailPendingApproval(result)).toBe(true);
    if (isSendEmailPendingApproval(result)) {
      expect(result.email.id).toBe("e9");
      expect(result.approval.id).toBe("ap_9");
    }
  });
});
