import z from 'zod';

export const WidgetSettingsSchema = z.object({
  widgetColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  widgetGreeting: z.string().min(1).max(300).optional(),
  name: z.string().min(2).max(100).optional(),
});