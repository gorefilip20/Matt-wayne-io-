import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminRequest } from "@/lib/auth/guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { allowedAttachmentTypes, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_DRAFT } from "@/lib/validation/newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sniffMime(bytes: Uint8Array): (typeof allowedAttachmentTypes)[number] | null {
  if (bytes.length >= 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-") return "application/pdf";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).join(",") === "137,80,78,71,13,10,26,10") return "image/png";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(new TextDecoder().decode(bytes.subarray(0, 6)))) return "image/gif";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
}

function safeFilename(value: string): string {
  const base = value.normalize("NFKC").split(/[\\/]/).pop() ?? "attachment";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "attachment";
}

export async function POST(request: NextRequest) {
  const auth = await checkAdminRequest(request, true);
  if ("response" in auth) return auth.response;

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_ATTACHMENT_BYTES + 1_048_576) {
    return NextResponse.json({ error: "Upload request exceeds the 20 MiB attachment limit." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload must use multipart form data." }, { status: 400 });
  }
  const fileValue = form.get("file");
  const draftId = String(form.get("draftId") ?? "");
  if (!(fileValue instanceof File) || !/^[0-9a-f-]{36}$/i.test(draftId)) {
    return NextResponse.json({ error: "Choose a file and save the draft before uploading." }, { status: 400 });
  }
  if (fileValue.size <= 0 || fileValue.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "Each attachment must be between 1 byte and 20 MiB." }, { status: 413 });
  }

  const buffer = Buffer.from(await fileValue.arrayBuffer());
  const detectedMime = sniffMime(buffer);
  if (!detectedMime || !allowedAttachmentTypes.includes(detectedMime)) {
    return NextResponse.json({ error: "Supported formats are PDF, JPG, PNG, GIF, and WebP." }, { status: 415 });
  }
  if (fileValue.type && fileValue.type !== "application/octet-stream" && fileValue.type !== detectedMime) {
    return NextResponse.json({ error: "The file extension or media type does not match its content." }, { status: 415 });
  }

  const supabase = getSupabaseAdmin();
  try {
    const { data: draft, error: draftError } = await supabase
      .from("newsletter_drafts")
      .select("id")
      .eq("id", draftId)
      .maybeSingle();
    if (draftError) throw draftError;
    if (!draft) return NextResponse.json({ error: "Save this draft before adding attachments." }, { status: 404 });

    const { data: existing, error: listError } = await supabase
      .from("newsletter_attachments")
      .select("id,size_bytes")
      .eq("draft_id", draftId);
    if (listError) throw listError;
    const currentBytes = (existing ?? []).reduce((total, row) => total + Number(row.size_bytes), 0);
    if ((existing ?? []).length >= MAX_ATTACHMENTS_PER_DRAFT || currentBytes + fileValue.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: "This draft can have up to 8 attachments and 20 MiB total." }, { status: 413 });
    }

    const id = randomUUID();
    const filename = safeFilename(fileValue.name);
    const storagePath = `${auth.session.openId}/${draftId}/${id}-${filename}`;
    const { error: uploadError } = await supabase.storage
      .from("newsletter-attachments")
      .upload(storagePath, buffer, { contentType: detectedMime, upsert: false, cacheControl: "0" });
    if (uploadError) throw uploadError;

    const { data: attachment, error: insertError } = await supabase
      .from("newsletter_attachments")
      .insert({
        id,
        draft_id: draftId,
        storage_path: storagePath,
        sanitized_filename: filename,
        content_type: detectedMime,
        size_bytes: fileValue.size,
      })
      .select("id,draft_id,sanitized_filename,content_type,size_bytes,created_at")
      .single();
    if (insertError) {
      await supabase.storage.from("newsletter-attachments").remove([storagePath]);
      throw insertError;
    }
    return NextResponse.json({ attachment }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Newsletter attachment upload failed", { code: (error as { code?: string })?.code ?? "unknown" });
    return NextResponse.json({ error: "Upload failed. Verify that the Supabase migration has been applied." }, { status: 503 });
  }
}
