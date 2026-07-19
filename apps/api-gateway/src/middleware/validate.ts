import type { Request, Response, NextFunction } from "express";
import { z, type ZodSchema } from "zod";

type RequestPart = "body" | "query" | "params";

export const validate =
  (schema: ZodSchema, source: RequestPart = "body", nested: string | null = null) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let data = nested ? req[source]?.[nested] : { ...req[source] };
      
      const parsedData = await schema.parseAsync(data);
      
      // Update request with parsed data (which includes default values and transformations from Zod)
      if (nested) {
        if (!req[source]) (req as any)[source] = {};
        req[source][nested] = parsedData;
      } else {
        (req as any)[source] = parsedData;
      }
      
      next();
    } catch (err) {
      console.log('ERROR OCCURRED WHILE REQUEST VALIDATION===>>', err);
      
      if (err instanceof z.ZodError) {
        const firstError = err.errors[0];
        const message = firstError?.message || 'Invalid request data';
        return res.status(400).json({ success: false, data: null, message });
      }
      
      return res.status(400).json({ success: false, data: null, message: 'Invalid request data' });
    }
  };

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const UuidParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});
