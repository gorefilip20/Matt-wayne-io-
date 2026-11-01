import { z } from "zod";

export const MAX_PROMPT_LENGTH = 4_000;
export const MAX_SUBJECT_LENGTH = 180;
export const MAX_HTML_LENGTH = 100_000;
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_DRAFT = 8;

export const allowedAttachmentTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const emailSchema = z.string().trim().max(320).email().transform((value) => value.toLowerCase());

export const signupSchema = z.object({
  email: emailSchema,
  consent: z.literal(true),
  company: z.string().max(200).optional().default(""),
});

export const draftSchema = z.object({
  id: z.string().uuid().optional(),
  prompt: z.string().trim().min(1).max(MAX_PROMPT_LENGTH),
  subject: z.string().trim().min(1).max(MAX_SUBJECT_LENGTH).transform((value) => value.replace(/\s+/g, " ").trim()).refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
  html: z.string().min(1).max(MAX_HTML_LENGTH),
  attachmentIds: z.array(z.string().uuid()).max(MAX_ATTACHMENTS_PER_DRAFT).default([]),
});

export const generateSchema = z.object({
  prompt: z.string().trim().min(8).max(MAX_PROMPT_LENGTH),
});

export const prepareBroadcastSchema = z.object({
  draftId: z.string().uuid(),
});

export const broadcastIdSchema = z.string().uuid();
