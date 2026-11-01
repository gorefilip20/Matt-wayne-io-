import "server-only";
import OpenAI from "openai";
import { env, requiredEnv } from "@/lib/env";
import { sanitizeNewsletterHtml } from "@/lib/email/sanitize";
import { MAX_HTML_LENGTH, MAX_SUBJECT_LENGTH } from "@/lib/validation/newsletter";

export type GeneratedNewsletter = { subject: string; html: string };

export async function generateNewsletter(prompt: string): Promise<GeneratedNewsletter> {
  const client = new OpenAI({ apiKey: requiredEnv("OPENAI_API_KEY") });
  const completion = await client.chat.completions.create({
    model: env("OPENAI_MODEL") ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You write clear, honest email newsletters for Matt Wayne's audience.",
          "Create a concise subject and email-ready HTML body. Do not promise trading profits or imply guaranteed returns.",
          "Return only a JSON object with string fields subject and html.",
          "Use semantic email-safe HTML: paragraphs, headings, bold/italic emphasis, lists, and links.",
          "Do not include scripts, iframes, forms, style blocks, tracking pixels, or external image tags.",
          "Do not add a personal recipient name or invent factual claims not present in the prompt.",
        ].join(" "),
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message.content;
  if (!raw) throw new Error("The AI provider returned an empty draft.");
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("The AI provider returned an invalid draft.");
  const value = parsed as Record<string, unknown>;
  const subject = typeof value.subject === "string" ? value.subject.trim().slice(0, MAX_SUBJECT_LENGTH) : "";
  const html = typeof value.html === "string" ? sanitizeNewsletterHtml(value.html) : "";
  if (!subject || !html || html.length > MAX_HTML_LENGTH) throw new Error("The AI provider returned an incomplete or oversized draft.");
  return { subject, html };
}
