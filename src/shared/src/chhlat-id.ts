import { z } from "zod";

/** Resolve machine identity from request bodies / WS params. */
export function resolveChhlatId(input: {
  chhlat_id?: string | null;
  chhlatId?: string | null;
}): string | undefined {
  return input.chhlat_id ?? input.chhlatId ?? undefined;
}

/**
 * Zod helper: requires `chhlat_id` and merges additional shape fields.
 */
export function withChhlatIdFields<T extends z.ZodRawShape>(shape: T) {
  return z.object({
    chhlat_id: z.string().min(1),
    ...shape,
  });
}
