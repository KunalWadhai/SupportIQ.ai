import type { Request, Response, NextFunction } from "express";
import { z, type ZodSchema } from "zod";

type RequestPart = "body" | "query" | "params";

/**
 * Express middleware factory that validates a request part against a Zod schema.
 * Attaches the parsed (typed) result back onto the request object.
 *
 * Usage:
 *   router.post("/", validate("body", MySchema), handler)
 */
export function validate<T extends ZodSchema>(
  part: RequestPart,
  schema: T
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const firstError = result.error.errors[0];
      return res.status(400).json({
        success: false,
        error: firstError.message,
        field: firstError.path.join("."),
      });
    }

    // Replace the raw input with the parsed/coerced value
    (req as any)[part] = result.data;
    next();
  };
}

// ─── Common reusable schemas ───────────────────────────────────────────────────
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const UuidParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});
