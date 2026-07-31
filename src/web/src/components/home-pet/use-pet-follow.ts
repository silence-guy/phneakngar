import { useCallback, useEffect, useRef, useState } from "react";
import type { PetPoint, PetBounds } from "./cloud-code-monster-pet-types";

const LERP_FACTOR = 0.08;
const VELOCITY_THRESHOLD = 0.5;

type UsePetFollowOptions = {
  /** Initial position of the pet */
  initialPosition: PetPoint;
  /** Pet dimensions for boundary calculations */
  petBounds: PetBounds;
  /** Whether mouse following is enabled by default */
  enabled?: boolean;
};

type UsePetFollowReturn = {
  /** Current animated position (lerped toward target) */
  targetPosition: PetPoint;
  /** Whether mouse following is currently active */
  isFollowing: boolean;
  /** Enable mouse following */
  enableFollowing: () => void;
  /** Disable mouse following */
  disableFollowing: () => void;
  /** Toggle mouse following state */
  toggleFollowing: () => void;
};

/**
 * Hook for mouse-follow behavior during scroll.
 * Tracks mouse position, smoothly animates pet toward cursor using lerp,
 * and keeps the pet within viewport boundaries.
 */
export function usePetFollow({
  initialPosition,
  petBounds,
  enabled: initialEnabled = false,
}: UsePetFollowOptions): UsePetFollowReturn {
  const [isFollowing, setIsFollowing] = useState(initialEnabled);
  const [position, setPosition] = useState<PetPoint>({ ...initialPosition });

  const currentPosition = useRef<PetPoint>({ ...initialPosition });
  const targetPosition = useRef<PetPoint>({ ...initialPosition });
  const mousePosition = useRef<PetPoint>({ x: -1000, y: -1000 });
  const animationFrameRef = useRef<number | null>(null);

  // Track mouse position during scroll
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosition.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Clamp position within viewport boundaries
  const clampToViewport = useCallback(
    (pos: PetPoint): PetPoint => {
      if (typeof window === "undefined") return pos;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

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
    },
    [petBounds]
  );

  // Animation loop using requestAnimationFrame and lerp
  useEffect(() => {
    const animate = () => {
      if (isFollowing) {
        // Use mouse position as target during following
        const clampedMouse = clampToViewport(mousePosition.current);
        targetPosition.current = clampedMouse;
      }

      // Lerp formula: current += (target - current) * factor
      const dx = targetPosition.current.x - currentPosition.current.x;
      const dy = targetPosition.current.y - currentPosition.current.y;

      // Only animate if we haven't converged
      if (Math.abs(dx) > VELOCITY_THRESHOLD || Math.abs(dy) > VELOCITY_THRESHOLD) {
        currentPosition.current = {
          x: currentPosition.current.x + dx * LERP_FACTOR,
          y: currentPosition.current.y + dy * LERP_FACTOR,
        };
      } else {
        // Snap to target when close enough
        currentPosition.current = { ...targetPosition.current };
      }

      // Update state to trigger re-render with new position
      setPosition({ ...currentPosition.current });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isFollowing, clampToViewport]);

  const enableFollowing = useCallback(() => {
    setIsFollowing(true);
  }, []);

  const disableFollowing = useCallback(() => {
    setIsFollowing(false);
  }, []);

  const toggleFollowing = useCallback(() => {
    setIsFollowing((prev) => !prev);
  }, []);

  return {
    targetPosition: position,
    isFollowing,
    enableFollowing,
    disableFollowing,
    toggleFollowing,
  };
}
