import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_DRAFT } from "@/lib/validation/newsletter";

export type DraftAttachment = {
  id: string;
  draftId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

export async function getDraftAttachments(draftId: string): Promise<DraftAttachment[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("newsletter_attachments")
    .select("id,draft_id,sanitized_filename,content_type,size_bytes")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    draftId: row.draft_id as string,
    filename: row.sanitized_filename as string,
    contentType: row.content_type as string,
    sizeBytes: Number(row.size_bytes),
  }));
}

export async function loadResendAttachments(draftId: string, attachmentIds: string[]) {
  const ids = [...new Set(attachmentIds)];
  if (!ids.length) return [];
  if (ids.length > MAX_ATTACHMENTS_PER_DRAFT) throw new Error("Too many attachments are attached to this draft.");

  const { data: rows, error } = await getSupabaseAdmin()
    .from("newsletter_attachments")
    .select("id,draft_id,storage_path,sanitized_filename,content_type,size_bytes")
    .eq("draft_id", draftId)
    .in("id", ids);
  if (error) throw error;
  if ((rows ?? []).length !== ids.length) throw new Error("One or more attachments are missing or do not belong to this draft.");

  const totalBytes = (rows ?? []).reduce((total, row) => total + Number(row.size_bytes), 0);
  if (totalBytes > MAX_ATTACHMENT_BYTES) throw new Error("Attachments exceed the 20 MiB campaign limit.");

  const supabase = getSupabaseAdmin();
  const attachments = await Promise.all((rows ?? []).map(async (row) => {
    const { data, error: downloadError } = await supabase.storage
      .from("newsletter-attachments")
      .download(row.storage_path as string);
    if (downloadError || !data) throw new Error("A private attachment could not be loaded.");
    const buffer = Buffer.from(await data.arrayBuffer());
    if (buffer.byteLength !== Number(row.size_bytes) || buffer.byteLength > MAX_ATTACHMENT_BYTES) {
      throw new Error("An attachment size changed after it was uploaded.");
    }
    return {
      filename: row.sanitized_filename as string,
      content: buffer.toString("base64"),
    };
  }));
  return attachments;
}
