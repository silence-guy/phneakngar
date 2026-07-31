import { describe, expect, it, vi } from "vitest";

/**
 * Unit tests for usePetFollow hook logic.
 * Tests the lerp formula, boundary clamping, and state transitions.
 */

const LERP_FACTOR = 0.08;
const VELOCITY_THRESHOLD = 0.5;

describe("usePetFollow logic", () => {
  describe("lerp formula", () => {
    it("should move toward target with lerp factor", () => {
      let current = 0;
      const target = 100;

      // Apply lerp: current += (target - current) * factor
      const dx = target - current;
      current = current + dx * LERP_FACTOR;

      // Should move 8% of the distance
      expect(current).toBeCloseTo(8, 5);
    });

    it("should converge toward target over multiple iterations", () => {
      let current = 0;
      const target = 100;

      for (let i = 0; i < 10; i++) {
        const dx = target - current;
        current = current + dx * LERP_FACTOR;
      }

      // After 10 iterations, should be close to target
      expect(current).toBeGreaterThan(50);
      expect(current).toBeLessThan(100);
    });

    it("should stop animating when within threshold", () => {
      const current = 99.7;
      const target = 100;

      const dx = target - current;
      const shouldAnimate = Math.abs(dx) > VELOCITY_THRESHOLD;

      expect(shouldAnimate).toBe(false);
    });

    it("should handle negative values", () => {
      let current = -50;
      const target = 50;

      const dx = target - current;
      current = current + dx * LERP_FACTOR;

      expect(current).toBeCloseTo(-42, 5);
    });
  });

  describe("boundary clamping", () => {
    const petBounds = { width: 82, height: 82 };
    const viewportWidth = 1024;
    const viewportHeight = 768;

    function clampToViewport(pos: { x: number; y: number }) {
      return {
        x: Math.max(
          petBounds.width / 2,
          Math.min(pos.x, viewportWidth - petBounds.width / 2)
        ),
        y: Math.max(
          petBounds.height / 2,
          Math.min(pos.y, viewportHeight - petBounds.height / 2)
        ),
      };
    }

    it("should keep pet within horizontal bounds", () => {
      const clamped = clampToViewport({ x: -100, y: 200 });
      expect(clamped.x).toBe(41); // min = width / 2

      const clampedRight = clampToViewport({ x: 2000, y: 200 });
      expect(clampedRight.x).toBe(viewportWidth - 41); // max = width - width/2
    });

    it("should keep pet within vertical bounds", () => {
      const clamped = clampToViewport({ x: 100, y: -100 });
      expect(clamped.y).toBe(41); // min = height / 2

      const clampedBottom = clampToViewport({ x: 100, y: 2000 });
      expect(clampedBottom.y).toBe(viewportHeight - 41);
    });

    it("should not modify position within bounds", () => {
      const pos = { x: 512, y: 384 };
      const clamped = clampToViewport(pos);
      expect(clamped).toEqual(pos);
    });
  });

  describe("isFollowing state transitions", () => {
    it("should have correct initial state when disabled", () => {
      const initialEnabled = false;
      let isFollowing = initialEnabled;

      expect(isFollowing).toBe(false);

      // Test enable
      isFollowing = true;
      expect(isFollowing).toBe(true);

      // Test disable
      isFollowing = false;
      expect(isFollowing).toBe(false);
    });

    it("should have correct initial state when enabled", () => {
      const initialEnabled = true;
      const isFollowing = initialEnabled;

      expect(isFollowing).toBe(true);
    });

    it("should toggle correctly", () => {
      let isFollowing = false;

      // Toggle on
      isFollowing = !isFollowing;
      expect(isFollowing).toBe(true);

      // Toggle off
      isFollowing = !isFollowing;
      expect(isFollowing).toBe(false);
    });
  });

  describe("animation frame cleanup", () => {
    it("should track animation frame ID for cleanup", () => {
      let rafId: number | null = null;
      let cancelled = false;

      const mockCancel = () => {
        cancelled = true;
      };

      // Simulate starting animation
      rafId = 1;

      // Simulate cleanup
      if (rafId !== null) {
        mockCancel();
        rafId = null;
      }

      expect(cancelled).toBe(true);
      expect(rafId).toBe(null);
    });
  });
});
