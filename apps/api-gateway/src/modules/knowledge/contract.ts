import z from 'zod';

export const UrlSchema = z.object({
    url: z.string().url(),
    name: z.string().optional()
});

