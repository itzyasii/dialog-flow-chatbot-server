import { z } from "zod";

export const clientProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().optional(),
    avatarUrl: z.string().trim().url().optional(),
  })
  .partial();

export const sendMessageSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  profile: clientProfileSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const getChatHistorySchema = z.object({
  clientUserId: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const webhookSchema = z.object({
  session: z.string().trim().optional(),
  responseId: z.string().trim().optional(),
  queryResult: z
    .object({
      action: z.string().trim().optional(),
      fulfillmentText: z.string().optional(),
      intentDetectionConfidence: z.number().optional(),
      queryText: z.string().optional(),
      intent: z
        .object({
          displayName: z.string().trim().optional(),
        })
        .optional(),
      parameters: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  originalDetectIntentRequest: z
    .object({
      payload: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});
