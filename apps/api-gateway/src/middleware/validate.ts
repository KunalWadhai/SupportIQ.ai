import type { Request, Response, NextFunction } from "express";
import { z, type ZodSchema } from "zod";

type RequestPart = "body" | "query" | "params";

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

    (req as any)[part] = result.data;
    next();
  };
}

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const UuidParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});
