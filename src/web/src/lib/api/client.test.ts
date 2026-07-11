import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiError } from "@/lib/errors";
import { apiFetch } from "./client";

describe("apiFetch", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    // Clear module cache to reset mock network logging state
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("successful responses", () => {
    it("returns parsed JSON on successful response", async () => {
      const mockData = { id: "1", name: "test" };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await apiFetch<typeof mockData>("/api/test");

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          credentials: "include",
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
        }),
      );
    });

    it("returns undefined on 204 No Content", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 204 }),
      );

      const result = await apiFetch<void>("/api/test");

      expect(result).toBeUndefined();
    });
  });

  describe("error responses", () => {
    it("throws ApiError with 401 status on 401 response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(apiFetch("/api/test")).rejects.toThrow(ApiError);
      await expect(apiFetch("/api/test")).rejects.toMatchObject({
        status: 401,
        message: "Unauthorized",
      });
    });

    it("redirects to /sign-in on 401 response in browser", async () => {
      const mockLocation = { href: "" };
      vi.stubGlobal("window", { location: mockLocation });

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(apiFetch("/api/test")).rejects.toThrow();
      expect(mockLocation.href).toBe("/sign-in");
    });

    it("throws ApiError with 429 status on rate limit", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(apiFetch("/api/test")).rejects.toThrow(ApiError);
      await expect(apiFetch("/api/test")).rejects.toMatchObject({
        status: 429,
        message: "Please wait a moment before trying again",
      });
    });

    it("throws ApiError with server message on 500 response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Internal server error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(apiFetch("/api/test")).rejects.toThrow(ApiError);
      await expect(apiFetch("/api/test")).rejects.toMatchObject({
        status: 500,
        message: "Internal server error",
      });
    });

    it("throws ApiError with generic message on 500 with no body", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Internal Server Error", {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }),
      );

      await expect(apiFetch("/api/test")).rejects.toThrow(ApiError);
      await expect(apiFetch("/api/test")).rejects.toMatchObject({
        status: 500,
        message: "Something went wrong — please try again",
      });
    });

    it("extracts error message from JSON error body", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "validation error", details: ["name: is required"] }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(apiFetch("/api/test")).rejects.toMatchObject({
        status: 400,
        message: "Name is required",
      });
    });

    it("throws ApiError with details array when available", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "validation error",
            details: ["email: invalid format", "password: too short"],
          }),
          {
            status: 422,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      try {
        await apiFetch("/api/test");
        fail("Expected ApiError to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).details).toEqual(["email: invalid format", "password: too short"]);
      }
    });
  });

  describe("network errors", () => {
    it("throws ApiError with connection message on network error", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      await expect(apiFetch("/api/test")).rejects.toThrow(ApiError);
      await expect(apiFetch("/api/test")).rejects.toMatchObject({
        status: 0,
        message: "Unable to connect — check your network",
      });
      await expect(apiFetch("/api/test")).rejects.toMatchObject({
        isNetworkError: true,
      });
    });

    it("rethrows non-TypeError network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(apiFetch("/api/test")).rejects.toThrow("Network unavailable");
    });
  });

  describe("request options", () => {
    it("passes through custom options", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await apiFetch("/api/test", {
        method: "POST",
        body: JSON.stringify({ data: "test" }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ data: "test" }),
          credentials: "include",
        }),
      );
    });

    it("merges custom headers with default Content-Type", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await apiFetch("/api/test", {
        headers: { Authorization: "Bearer token123" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer token123",
          }),
        }),
      );
    });

    it("allows overriding Content-Type header", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await apiFetch("/api/test", {
        headers: { "Content-Type": "multipart/form-data" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "multipart/form-data",
          }),
        }),
      );
    });
  });
});
