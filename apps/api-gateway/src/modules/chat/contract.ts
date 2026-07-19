import z from 'zod';
import { v4 as uuidv4 } from "uuid";

export const ChatSchema = z.object({
  sessionId: z.string().uuid().optional().default(() => uuidv4()),
  message: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  visitorEmail: z.string().email().optional(),
});

