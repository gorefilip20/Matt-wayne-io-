import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const recipientStatuses = ["pending", "sending", "sent", "failed", "skipped"] as const;
export type BroadcastProgress = Record<(typeof recipientStatuses)[number], number> & { total: number; done: boolean };

type AdminClient = SupabaseClient;

export async function getBroadcastProgress(supabase: AdminClient, broadcastId: string): Promise<BroadcastProgress> {
  const counts = await Promise.all(recipientStatuses.map(async (status) => {
    const { count, error } = await supabase
      .from("newsletter_broadcast_recipients")
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", broadcastId)
      .eq("status", status);
    if (error) throw error;
    return [status, count ?? 0] as const;
  }));
  const progress = Object.fromEntries(counts) as Record<(typeof recipientStatuses)[number], number>;
  return {
    ...progress,
    total: Object.values(progress).reduce((sum, count) => sum + count, 0),
    done: progress.pending === 0 && progress.sending === 0,
  };
}

export async function refreshBroadcastStatus(supabase: AdminClient, broadcastId: string, startedAt?: string | null) {
  const progress = await getBroadcastProgress(supabase, broadcastId);
  const status = progress.done
    ? progress.failed > 0
      ? progress.sent > 0 || progress.skipped > 0 ? "partial" : "failed"
      : "completed"
    : "sending";
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("newsletter_broadcasts")
    .update({
      status,
      started_at: startedAt ?? now,
      completed_at: progress.done ? now : null,
      updated_at: now,
    })
    .eq("id", broadcastId);
  if (error) throw error;
  return { progress, status };
}
