import "server-only";
import { createHash } from "node:crypto";
import { createUnsubscribeToken, hashUnsubscribeToken } from "@/lib/email/unsubscribe";
import { getBroadcastProgress, refreshBroadcastStatus } from "@/lib/email/broadcasts";
import { loadResendAttachments } from "@/lib/email/attachments";
import { getResendFrom, sendResendBatch, sendResendMessage, type ResendMessage } from "@/lib/email/resend";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Recipient = {
  id: string;
  subscriber_id: string | null;
  email_snapshot: string;
  unsubscribe_token_hash_snapshot: string;
  attempt_count: number;
  consented_at?: string | null;
};

type Campaign = {
  id: string;
  draft_id: string | null;
  subject_snapshot: string;
  html_snapshot: string;
  attachment_ids: string[] | null;
  app_origin: string;
  status: string;
  started_at: string | null;
};

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function messageFor(campaign: Campaign, recipient: Recipient, attachments?: Awaited<ReturnType<typeof loadResendAttachments>>): ResendMessage | null {
  if (!recipient.subscriber_id || !recipient.consented_at) return null;
  const token = createUnsubscribeToken(recipient.subscriber_id, recipient.consented_at);
  if (hashUnsubscribeToken(token) !== recipient.unsubscribe_token_hash_snapshot) return null;
  const webUrl = new URL(`/unsubscribe/${encodeURIComponent(token)}`, campaign.app_origin).toString();
  const oneClickUrl = new URL(`/api/unsubscribe/${encodeURIComponent(token)}`, campaign.app_origin).toString();
  const footer = `<hr><p style="font:12px/1.6 Arial,sans-serif;color:#64748b">You are receiving this because you opted in to Matt Wayne newsletter updates. <a href="${escapeAttribute(webUrl)}">Unsubscribe</a>.</p>`;
  return {
    from: getResendFrom(),
    to: [recipient.email_snapshot],
    subject: campaign.subject_snapshot,
    html: `${campaign.html_snapshot}${footer}`,
    headers: {
      "List-Unsubscribe": `<${oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    ...(attachments?.length ? { attachments } : {}),
  };
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Delivery failed.";
  return message.replace(/[\r\n\0]/g, " ").slice(0, 500);
}

async function updateRecipient(
  recipientId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("newsletter_broadcast_recipients")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", recipientId);
  if (error) throw error;
}

async function mapLimit<T>(items: T[], limit: number, handler: (item: T) => Promise<void>) {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      if (current !== undefined) await handler(current);
    }
  }));
}

export async function runBroadcastChunk(broadcastId: string) {
  const supabase = getSupabaseAdmin();
  const { data: campaignData, error: campaignError } = await supabase
    .from("newsletter_broadcasts")
    .select("id,draft_id,subject_snapshot,html_snapshot,attachment_ids,app_origin,status,started_at")
    .eq("id", broadcastId)
    .maybeSingle();
  if (campaignError) throw campaignError;
  if (!campaignData) throw new Error("Broadcast not found.");
  const campaign = campaignData as Campaign;
  if (["completed", "cancelled"].includes(campaign.status)) {
    return { ...(await getBroadcastProgress(supabase, broadcastId)), status: campaign.status, done: true };
  }

  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: staleRows, error: staleError } = await supabase
    .from("newsletter_broadcast_recipients")
    .select("id")
    .eq("broadcast_id", broadcastId)
    .eq("status", "sending")
    .lt("updated_at", staleBefore);
  if (staleError) throw staleError;
  if (staleRows?.length) {
    const { error } = await supabase
      .from("newsletter_broadcast_recipients")
      .update({ status: "pending", last_error: "Recovered after an interrupted send; retry uses the same idempotency key.", updated_at: new Date().toISOString() })
      .in("id", staleRows.map((row) => row.id));
    if (error) throw error;
  }

  const hasAttachments = (campaign.attachment_ids ?? []).length > 0;
  const batchSize = hasAttachments ? 10 : 100;
  const { data: pendingRows, error: pendingError } = await supabase
    .from("newsletter_broadcast_recipients")
    .select("id,subscriber_id,email_snapshot,unsubscribe_token_hash_snapshot,attempt_count")
    .eq("broadcast_id", broadcastId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (pendingError) throw pendingError;

  const claimed: Recipient[] = [];
  for (const row of (pendingRows ?? []) as Recipient[]) {
    const { data, error } = await supabase
      .from("newsletter_broadcast_recipients")
      .update({ status: "sending", attempt_count: row.attempt_count + 1, updated_at: new Date().toISOString(), last_error: null })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id,subscriber_id,email_snapshot,unsubscribe_token_hash_snapshot,attempt_count")
      .maybeSingle();
    if (error) throw error;
    if (data) claimed.push(data as Recipient);
  }

  if (claimed.length) {
    const subscriberIds = claimed.map((row) => row.subscriber_id).filter((id): id is string => Boolean(id));
    const { data: activeRows, error: activeError } = await supabase
      .from("newsletter_subscribers")
      .select("id,consented_at")
      .in("id", subscriberIds)
      .eq("status", "active");
    if (activeError) throw activeError;
    const consentById = new Map((activeRows ?? []).map((row) => [row.id as string, row.consented_at as string]));
    const sendable: Recipient[] = [];
    for (const recipient of claimed) {
      const consentedAt = recipient.subscriber_id ? consentById.get(recipient.subscriber_id) : undefined;
      const token = recipient.subscriber_id && consentedAt ? createUnsubscribeToken(recipient.subscriber_id, consentedAt) : "";
      if (!recipient.subscriber_id || !consentedAt || hashUnsubscribeToken(token) !== recipient.unsubscribe_token_hash_snapshot) {
        await updateRecipient(recipient.id, { status: "skipped", last_error: "Subscriber is no longer active or its preferences changed." });
      } else {
        sendable.push({ ...recipient, consented_at: consentedAt });
      }
    }

    if (sendable.length) {
      let attachmentPayload: Awaited<ReturnType<typeof loadResendAttachments>> = [];
      let attachmentLoadFailed = false;
      if (hasAttachments) {
        try {
          if (!campaign.draft_id) throw new Error("Campaign attachment source is unavailable.");
          attachmentPayload = await loadResendAttachments(campaign.draft_id, campaign.attachment_ids ?? []);
        } catch (error) {
          attachmentLoadFailed = true;
          const message = safeError(error);
          await Promise.all(sendable.map((recipient) => updateRecipient(recipient.id, { status: "failed", last_error: message })));
        }
      }

      if (!attachmentLoadFailed) {
        const messages = sendable.map((recipient) => ({ recipient, message: messageFor(campaign, recipient, attachmentPayload) }));
        const validMessages = messages.filter((item): item is { recipient: Recipient; message: ResendMessage } => Boolean(item.message));
        const invalidMessages = messages.filter((item) => !item.message);
        await Promise.all(invalidMessages.map((item) => updateRecipient(item.recipient.id, { status: "skipped", last_error: "Unsubscribe token validation failed." })));

        if (validMessages.length && !hasAttachments) {
          const ids = validMessages.map((item) => item.recipient.id).join(",");
          const key = `newsletter-${broadcastId}-${createHash("sha256").update(ids).digest("hex").slice(0, 32)}`;
          try {
            const providerIds = await sendResendBatch(validMessages.map((item) => item.message), key);
            await Promise.all(validMessages.map((item, index) => updateRecipient(item.recipient.id, {
              status: "sent",
              provider_message_id: providerIds[index],
              sent_at: new Date().toISOString(),
              last_error: null,
            })));
          } catch (error) {
            const message = safeError(error);
            await Promise.all(validMessages.map((item) => updateRecipient(item.recipient.id, { status: "failed", last_error: message })));
          }
        } else if (validMessages.length) {
          await mapLimit(validMessages, 3, async ({ recipient, message }) => {
            try {
              const providerId = await sendResendMessage(message, `newsletter-${broadcastId}-${recipient.id}`);
              await updateRecipient(recipient.id, { status: "sent", provider_message_id: providerId, sent_at: new Date().toISOString(), last_error: null });
            } catch (error) {
              await updateRecipient(recipient.id, { status: "failed", last_error: safeError(error) });
            }
          });
        }
      }
    }
  }

  const updated = await refreshBroadcastStatus(supabase, broadcastId, campaign.started_at);
  return { ...updated.progress, status: updated.status, done: updated.progress.done };
}
