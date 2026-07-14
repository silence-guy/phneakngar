import { describe, expect, it, vi } from "vitest";

const mockGetMachineByChhlat = vi.fn();

vi.mock("@phneakngar/shared", () => ({
  queries: {
    machine: {
      getMachineByChhlat: (...args: unknown[]) => mockGetMachineByChhlat(...args),
    },
  },
}));

import { withChhlatMachine } from "./chhlat";

describe("withChhlatMachine", () => {
  it("rejects same-user/workspace access to a different chhlat than the token hostname", async () => {
    mockGetMachineByChhlat.mockResolvedValue({
      chhlatId: "host-b",
      workspaceId: "w1",
      ownerId: "u1",
    });

    const result = await withChhlatMachine({} as any, {
      env: {} as any,
      userId: "u1",
      email: "u@test.com",
      authType: "machine",
      workspaceId: "w1",
      machineTokenHostname: "host-a",
    }, "host-b");

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(mockGetMachineByChhlat).not.toHaveBeenCalled();
  });

  it("allows the token-recorded chhlat hostname", async () => {
    mockGetMachineByChhlat.mockResolvedValue({
      chhlatId: "host-a",
      workspaceId: "w1",
      ownerId: "u1",
    });

    const result = await withChhlatMachine({} as any, {
      env: {} as any,
      userId: "u1",
      email: "u@test.com",
      authType: "machine",
      workspaceId: "w1",
      machineTokenHostname: "host-a",
    }, "host-a");

    expect(result).toEqual({ workspaceId: "w1", chhlatId: "host-a" });
  });
});
