"use client";

import {
  AlertCircle, ArrowUpRight, Bold, Check, ChevronDown, CircleCheck, Clock3, FileText,
  Heading1, Heading2, Italic, Link2, List, ListOrdered, LoaderCircle, LogOut, Mail,
  Paperclip, Pause, Play, Quote, RefreshCw, Save, Send, ShieldCheck, Sparkles,
  Trash2, Underline as UnderlineIcon, Users, WandSparkles, X,
} from "lucide-react";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Readiness = { supabase: boolean; openai: boolean; resend: boolean; oauth: boolean };
type Props = { name: string; email: string; readiness: Readiness };
type DraftSummary = { id: string; prompt: string; subject: string; html_content: string; updated_at: string; attachment_ids?: string[] };
type Attachment = { id: string; filename: string; contentType: string; sizeBytes: number };
type Broadcast = {
  id: string;
  subject_snapshot: string;
  recipient_count: number;
  status: "queued" | "sending" | "completed" | "partial" | "failed" | "cancelled";
  created_at: string;
  attachment_ids: string[];
};
type Progress = { total: number; pending: number; sending: number; sent: number; failed: number; skipped: number; done: boolean };
type Notice = { kind: "success" | "error" | "info"; text: string };
type Prepared = { id: string; recipientCount: number; subject: string; attachments: Attachment[] };

const starterHtml = "<p>Start writing your newsletter here. Your readers will see this as an email.</p>";
const defaultPrompt = "";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

async function responseData<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.error === "string" ? data.error : "The request could not be completed.";
    throw new Error(response.status === 401 ? "Your session expired. Sign in again to continue." : message);
  }
  return data as T;
}

export function AdminDashboard({ name, email, readiness }: Props) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [subject, setSubject] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [editorHtml, setEditorHtml] = useState(starterHtml);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [processing, setProcessing] = useState(false);
  const [activeBroadcastId, setActiveBroadcastId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const stopAfterChunk = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingHtml = useRef<string | null>(null);

  const extensions = useMemo(() => [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, underline: false }),
    Underline,
    Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
    Placeholder.configure({ placeholder: "Write a clear, useful note for your audience…" }),
  ], []);

  const editor = useEditor({
    extensions,
    content: starterHtml,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => setEditorHtml(current.getHTML()),
  });

  useEffect(() => {
    if (editor && pendingHtml.current !== null) {
      editor.commands.setContent(pendingHtml.current, { emitUpdate: false });
      pendingHtml.current = null;
    }
  }, [editor, draftId]);

  const refreshBroadcasts = useCallback(async () => {
    const response = await fetch("/api/admin/broadcasts", { cache: "no-store" });
    const data = await responseData<{ broadcasts: Broadcast[] }>(response);
    setBroadcasts(data.broadcasts);
    return data.broadcasts;
  }, []);

  const refreshWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const [subscribersResult, draftsResult] = await Promise.all([
        fetch("/api/admin/subscribers", { cache: "no-store" }),
        fetch("/api/admin/drafts", { cache: "no-store" }),
      ]);
      const subscriberData = await responseData<{ activeSubscribers: number }>(subscribersResult);
      const draftData = await responseData<{ drafts: DraftSummary[] }>(draftsResult);
      setSubscriberCount(subscriberData.activeSubscribers);
      setDrafts(draftData.drafts);
      await refreshBroadcasts();
      if (draftData.drafts.length) await loadDraft(draftData.drafts[0].id);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Workspace data could not be loaded." });
    } finally {
      setLoading(false);
    }
  // loadDraft is intentionally stable for one initialization pass.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshBroadcasts]);

  useEffect(() => { void refreshWorkspace(); }, [refreshWorkspace]);

  async function loadDraft(id: string) {
    try {
      const response = await fetch(`/api/admin/drafts/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await responseData<{ draft: DraftSummary & { attachment_ids?: string[] }; attachments: Array<{ id: string; filename: string; contentType: string; sizeBytes: number }> }>(response);
      setDraftId(data.draft.id);
      setPrompt(data.draft.prompt);
      setSubject(data.draft.subject);
      setEditorHtml(data.draft.html_content);
      setAttachments(data.attachments ?? []);
      if (editor) editor.commands.setContent(data.draft.html_content, { emitUpdate: false });
      else pendingHtml.current = data.draft.html_content;
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Draft could not be opened." });
    }
  }

  function startNewDraft() {
    setDraftId(null);
    setPrompt("");
    setSubject("");
    setAttachments([]);
    setEditorHtml(starterHtml);
    if (editor) editor.commands.setContent(starterHtml, { emitUpdate: false });
    else pendingHtml.current = starterHtml;
    setNotice({ kind: "info", text: "New draft started. Add a topic prompt and subject, or generate a first draft." });
  }

  async function persistDraft(attachmentIds = attachments.map((item) => item.id), idOverride = draftId): Promise<string | null> {
    if (!prompt.trim()) {
      setNotice({ kind: "error", text: "Add a Promotion / Topic Prompt before saving." });
      return null;
    }
    if (!subject.trim()) {
      setNotice({ kind: "error", text: "Add a subject line before saving." });
      return null;
    }
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: idOverride ?? undefined, prompt, subject, html: editor?.getHTML() ?? editorHtml, attachmentIds }),
      });
      const data = await responseData<{ draft: DraftSummary & { attachment_ids?: string[] } }>(response);
      setDraftId(data.draft.id);
      setDrafts((current) => [data.draft, ...current.filter((item) => item.id !== data.draft.id)].slice(0, 30));
      setNotice({ kind: "success", text: "Draft saved securely." });
      return data.draft.id;
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Draft could not be saved." });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function generateDraft() {
    if (!prompt.trim()) {
      setNotice({ kind: "error", text: "Enter the promotion or topic you want the newsletter to cover." });
      return;
    }
    setGenerating(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await responseData<{ subject: string; html: string }>(response);
      setSubject(data.subject);
      setEditorHtml(data.html);
      if (editor) editor.commands.setContent(data.html, { emitUpdate: false });
      else pendingHtml.current = data.html;
      setNotice({ kind: "success", text: "AI draft generated. Review and edit it before sending." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Draft generation failed." });
    } finally {
      setGenerating(false);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    let currentId = draftId;
    if (!currentId) currentId = await persistDraft([]);
    if (!currentId) return;
    setUploading(true);
    setNotice(null);
    let nextAttachments = [...attachments];
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("draftId", currentId);
        form.append("file", file);
        const response = await fetch("/api/admin/attachments", { method: "POST", body: form });
        const data = await responseData<{ attachment: { id: string; sanitized_filename: string; content_type: string; size_bytes: number } }>(response);
        nextAttachments = [...nextAttachments, {
          id: data.attachment.id,
          filename: data.attachment.sanitized_filename,
          contentType: data.attachment.content_type,
          sizeBytes: Number(data.attachment.size_bytes),
        }];
      }
      setAttachments(nextAttachments);
      await persistDraft(nextAttachments.map((item) => item.id), currentId);
      setNotice({ kind: "success", text: `${files.length} attachment${files.length === 1 ? "" : "s"} added to the draft.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Attachment upload failed." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeAttachment(attachment: Attachment) {
    try {
      const response = await fetch(`/api/admin/attachments/${encodeURIComponent(attachment.id)}`, { method: "DELETE" });
      await responseData<{ ok: boolean }>(response);
      const nextAttachments = attachments.filter((item) => item.id !== attachment.id);
      setAttachments(nextAttachments);
      if (draftId) await persistDraft(nextAttachments.map((item) => item.id), draftId);
      setNotice({ kind: "success", text: "Attachment removed." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Attachment could not be removed." });
    }
  }

  async function prepareBroadcast() {
    const savedId = await persistDraft();
    if (!savedId) return;
    setPreparing(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/broadcasts/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: savedId, origin: window.location.origin }),
      });
      const data = await responseData<{ broadcast: { id: string; subject_snapshot: string; recipient_count: number; attachment_ids: string[]; attachments: Attachment[] }; recipientCount: number }>(response);
      setPrepared({
        id: data.broadcast.id,
        recipientCount: data.recipientCount,
        subject: data.broadcast.subject_snapshot,
        attachments: data.broadcast.attachments,
      });
      await refreshBroadcasts();
      setNotice({ kind: "info", text: "Audience snapshot prepared. Review the exact count before confirming delivery." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Audience snapshot could not be prepared." });
    } finally {
      setPreparing(false);
    }
  }

  async function refreshProgress(id: string) {
    const response = await fetch(`/api/admin/broadcasts/${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await responseData<{ progress: Progress }>(response);
    setProgress(data.progress);
    return data.progress;
  }

  async function processBroadcast(id: string) {
    setActiveBroadcastId(id);
    setProcessing(true);
    stopAfterChunk.current = false;
    setNotice({ kind: "info", text: "Broadcast started. Delivery progress is being saved after each batch." });
    try {
      for (;;) {
        if (stopAfterChunk.current) break;
        const response = await fetch(`/api/admin/broadcasts/${encodeURIComponent(id)}/process`, { method: "POST" });
        const data = await responseData<Progress & { status: string }>(response);
        setProgress(data);
        if (data.done) {
          setNotice({
            kind: data.failed ? "error" : "success",
            text: data.failed
              ? `Broadcast finished with ${data.sent} sent, ${data.failed} failed, and ${data.skipped} skipped. You can retry failures.`
              : `Broadcast finished: ${data.sent} sent, ${data.skipped} skipped.`,
          });
          break;
        }
      }
      if (stopAfterChunk.current) setNotice({ kind: "info", text: "Paused after the current batch. The campaign is saved and can be resumed." });
      await refreshProgress(id);
      await refreshBroadcasts();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Delivery paused. Resume the saved campaign to continue." });
    } finally {
      setProcessing(false);
    }
  }

  async function confirmPreparedBroadcast() {
    if (!prepared) return;
    setModalOpen(false);
    setActiveBroadcastId(prepared.id);
    setProgress({ total: prepared.recipientCount, pending: prepared.recipientCount, sending: 0, sent: 0, failed: 0, skipped: 0, done: false });
    setPrepared(null);
    await processBroadcast(prepared.id);
  }

  async function retryBroadcast(id: string) {
    try {
      const response = await fetch(`/api/admin/broadcasts/${encodeURIComponent(id)}/retry`, { method: "POST" });
      await responseData<{ ok: boolean; retryCount: number }>(response);
      await processBroadcast(id);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Failed recipients could not be queued." });
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/admin/login");
  }

  function addLink() {
    if (!editor) return;
    const existing = editor.getAttributes("link").href as string | undefined;
    const value = window.prompt("Paste a secure https:// or mailto: link", existing ?? "https://");
    if (value === null) return;
    const href = value.trim();
    if (!/^(https:\/\/|mailto:)/i.test(href)) {
      setNotice({ kind: "error", text: "Links must begin with https:// or mailto:." });
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  const previewDocument = useMemo(() => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px/1.65 Arial,sans-serif;color:#152741;padding:26px;max-width:620px;margin:0 auto}h1,h2,h3{line-height:1.2}a{color:#205cff}blockquote{border-left:3px solid #205cff;padding-left:14px;color:#566b85}hr{border:0;border-top:1px solid #dbe4ef}</style></head><body>${editorHtml}<hr><p style="font-size:12px;color:#64748b">You are receiving this because you opted in to Matt Wayne newsletter updates. Unsubscribe link appears in the delivered email.</p></body></html>`, [editorHtml]);

  const configurationItems = [
    ["Supabase", readiness.supabase],
    ["OpenAI", readiness.openai],
    ["Resend", readiness.resend],
    ["OAuth", readiness.oauth],
  ] as const;
  const missing = configurationItems.filter(([, ready]) => !ready).map(([label]) => label);
  const activeBroadcasts = broadcasts.filter((item) => ["queued", "sending"].includes(item.status));

  return (
    <div className="studio-shell">
      <aside className="studio-sidebar">
        <a className="studio-brand" href="/admin" aria-label="Matt Wayne newsletter studio home">
          <span className="brand-mark">MW</span>
          <span className="brand-lockup"><strong>Matt Wayne</strong><small>NEWSLETTER STUDIO</small></span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Workspace">
          <a className="nav-link is-current" href="#studio"><Mail size={17} /> Studio <span className="nav-pip" /></a>
          <a className="nav-link" href="#drafts"><FileText size={17} /> Drafts <span className="nav-count">{drafts.length}</span></a>
          <a className="nav-link" href="#audience"><Users size={17} /> Audience <span className="nav-count">{subscriberCount ?? "—"}</span></a>
          <a className="nav-link" href="#campaigns"><Send size={17} /> Campaigns</a>
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-security"><ShieldCheck size={17} /><span>Private workspace<br /><small>Manus account protected</small></span></div>
        <div className="sidebar-profile">
          <img src="/images/profile-pic.png" alt="" width="36" height="36" />
          <span><strong>{name}</strong><small>{email}</small></span>
          <button className="icon-button profile-logout" type="button" aria-label="Sign out" title="Sign out" onClick={logout}><LogOut size={16} /></button>
        </div>
      </aside>

      <main className="studio-main" id="studio">
        <header className="studio-topbar">
          <div><span className="topbar-kicker">CONTENT OPERATIONS</span><h1>Newsletter studio</h1></div>
          <div className="topbar-actions">
            <span className="saved-indicator"><span /> Private draft space</span>
            <button className="button button-quiet" type="button" onClick={startNewDraft}><FileText size={16} /> New draft</button>
          </div>
        </header>

        {missing.length > 0 ? (
          <section className="setup-banner" role="status">
            <div className="setup-icon"><AlertCircle size={19} /></div>
            <div><strong>Finish the server setup before using live services.</strong><p>Missing: {missing.join(", ")}. Apply the Supabase migration and add the protected environment values from the project README.</p></div>
            <span className="setup-badge">SETUP REQUIRED</span>
          </section>
        ) : null}

        {notice ? (
          <div className={`notice notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
            {notice.kind === "success" ? <CircleCheck size={17} /> : notice.kind === "error" ? <AlertCircle size={17} /> : <Clock3 size={17} />}
            <span>{notice.text}</span>
            <button className="icon-button notice-close" type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}><X size={15} /></button>
          </div>
        ) : null}

        <section className="metrics-row" aria-label="Workspace summary">
          <article className="metric-card"><span className="metric-icon metric-blue"><Users size={18} /></span><div><span className="metric-label">ACTIVE SUBSCRIBERS</span><strong>{subscriberCount === null ? "—" : subscriberCount.toLocaleString()}</strong><small>Opted in · unsubscribed excluded</small></div></article>
          <article className="metric-card"><span className="metric-icon metric-violet"><FileText size={18} /></span><div><span className="metric-label">SAVED DRAFTS</span><strong>{drafts.length}</strong><small>Private and editable</small></div></article>
          <article className="metric-card"><span className="metric-icon metric-green"><Send size={18} /></span><div><span className="metric-label">CAMPAIGNS</span><strong>{broadcasts.length}</strong><small>Delivery history retained</small></div></article>
        </section>

        {activeBroadcasts.length ? (
          <section className="resume-strip" aria-label="Campaigns that can be resumed">
            <div className="resume-strip-copy"><span className="live-indicator" /><strong>{activeBroadcasts.length} campaign{activeBroadcasts.length === 1 ? "" : "s"} ready or in progress</strong><span>Delivery state is saved after every batch.</span></div>
            <div className="resume-strip-actions">{activeBroadcasts.slice(0, 2).map((campaign) => <button key={campaign.id} className="button button-quiet button-small" type="button" disabled={processing} onClick={() => void processBroadcast(campaign.id)}><Play size={14} /> Resume {campaign.subject_snapshot.slice(0, 24)}</button>)}</div>
          </section>
        ) : null}

        <div className="studio-grid">
          <div className="studio-primary-column">
            <section className="panel prompt-panel" aria-labelledby="prompt-heading">
              <div className="panel-heading"><div className="panel-title-wrap"><span className="step-badge">01</span><div><h2 id="prompt-heading">Set the direction</h2><p>Tell the AI what this issue should accomplish.</p></div></div><span className="private-chip"><ShieldCheck size={13} /> PRIVATE</span></div>
              <label className="field-label" htmlFor="topic-prompt">PROMOTION / TOPIC PROMPT</label>
              <textarea id="topic-prompt" className="prompt-input" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={4000} placeholder="Example: announce the new beginner’s guide, explain what it covers, and invite readers to explore it. Keep the tone practical and avoid making performance promises." />
              <div className="prompt-footer"><span>{prompt.length.toLocaleString()} / 4,000 characters</span><button className="button button-primary" type="button" onClick={() => void generateDraft()} disabled={generating || !prompt.trim()}>{generating ? <LoaderCircle className="spin" size={16} /> : <WandSparkles size={16} />}{generating ? "Generating…" : "Generate first draft"}</button></div>
            </section>

            <section className="panel editor-panel" aria-labelledby="editor-heading">
              <div className="panel-heading editor-panel-heading"><div className="panel-title-wrap"><span className="step-badge">02</span><div><h2 id="editor-heading">Review and edit</h2><p>Nothing is sent until you confirm the audience and send.</p></div></div><div className="editor-head-actions"><button className={`button button-quiet button-small ${previewMode ? "is-selected" : ""}`} type="button" onClick={() => setPreviewMode((current) => !current)}>{previewMode ? "Back to editor" : "Preview email"}</button></div></div>
              <label className="field-label" htmlFor="email-subject">SUBJECT LINE</label>
              <input id="email-subject" className="subject-input" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={180} placeholder="Add a subject line your readers will recognize" />

              {!previewMode ? (
                <div className="editor-frame">
                  <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
                    <button className={`tool-button ${editor?.isActive("bold") ? "is-active" : ""}`} type="button" aria-label="Bold" title="Bold" disabled={!editor} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={16} /></button>
                    <button className={`tool-button ${editor?.isActive("italic") ? "is-active" : ""}`} type="button" aria-label="Italic" title="Italic" disabled={!editor} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
                    <button className={`tool-button ${editor?.isActive("underline") ? "is-active" : ""}`} type="button" aria-label="Underline" title="Underline" disabled={!editor} onClick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon size={16} /></button>
                    <span className="toolbar-divider" />
                    <button className={`tool-button ${editor?.isActive("heading", { level: 1 }) ? "is-active" : ""}`} type="button" aria-label="Heading 1" title="Heading 1" disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={17} /></button>
                    <button className={`tool-button ${editor?.isActive("heading", { level: 2 }) ? "is-active" : ""}`} type="button" aria-label="Heading 2" title="Heading 2" disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={17} /></button>
                    <button className={`tool-button ${editor?.isActive("bulletList") ? "is-active" : ""}`} type="button" aria-label="Bulleted list" title="Bulleted list" disabled={!editor} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={16} /></button>
                    <button className={`tool-button ${editor?.isActive("orderedList") ? "is-active" : ""}`} type="button" aria-label="Numbered list" title="Numbered list" disabled={!editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></button>
                    <button className={`tool-button ${editor?.isActive("blockquote") ? "is-active" : ""}`} type="button" aria-label="Quote" title="Quote" disabled={!editor} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={16} /></button>
                    <button className={`tool-button ${editor?.isActive("link") ? "is-active" : ""}`} type="button" aria-label="Add link" title="Add link" disabled={!editor} onClick={addLink}><Link2 size={16} /></button>
                    <span className="toolbar-divider toolbar-end-divider" />
                    <button className="tool-button tool-attach" type="button" aria-label="Attach a file" title="Attach PDF or image" disabled={uploading} onClick={() => fileInputRef.current?.click()}>{uploading ? <LoaderCircle className="spin" size={16} /> : <Paperclip size={16} />}</button>
                    <input ref={fileInputRef} className="visually-hidden" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/gif,image/webp" onChange={(event) => void uploadFiles(event.target.files)} />
                  </div>
                  <div className="editor-content"><EditorContent editor={editor} /></div>
                  <div className="editor-status"><span><span className="status-dot status-dot-small" /> Rich text editor</span><span>{editorHtml.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length} words</span></div>
                </div>
              ) : (
                <div className="email-preview-frame"><div className="preview-meta"><span>TO</span> Your opted-in subscribers <span>·</span> <span>SUBJECT</span> {subject || "No subject yet"}</div><iframe title="Newsletter email preview" sandbox="" srcDoc={previewDocument} /></div>
              )}

              {attachments.length ? (
                <div className="attachment-list"><div className="attachment-title"><span>ATTACHMENTS <small>{attachments.length} / 8 · {formatBytes(attachments.reduce((sum, item) => sum + item.sizeBytes, 0))} / 20 MB</small></span></div>
                  {attachments.map((attachment) => <div className="attachment-item" key={attachment.id}><span className="attachment-file-icon"><FileText size={15} /></span><span className="attachment-name"><strong>{attachment.filename}</strong><small>{attachment.contentType} · {formatBytes(attachment.sizeBytes)}</small></span><button className="icon-button attachment-remove" type="button" aria-label={`Remove ${attachment.filename}`} title="Remove attachment" onClick={() => void removeAttachment(attachment)}><Trash2 size={15} /></button></div>)}
                </div>
              ) : null}

              <div className="editor-actions"><div className="editor-action-note"><ShieldCheck size={15} /> Review the email preview before sending.</div><div className="editor-action-buttons"><button className="button button-quiet" type="button" onClick={() => void persistDraft()} disabled={saving || !prompt.trim() || !subject.trim()}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{saving ? "Saving…" : "Save draft"}</button><button className="button button-send" type="button" onClick={() => { setPrepared(null); setModalOpen(true); }} disabled={processing || !subject.trim() || !prompt.trim()}><Send size={16} /> Send to All Subscribers <ArrowUpRight size={15} /></button></div></div>
            </section>
          </div>

          <aside className="studio-rail">
            <section className="rail-card audience-card" id="audience"><div className="rail-card-heading"><span className="metric-icon metric-blue"><Users size={17} /></span><span className="rail-kicker">YOUR AUDIENCE</span></div><strong className="audience-count">{subscriberCount === null ? "—" : subscriberCount.toLocaleString()}</strong><p>active, opted-in subscribers</p><div className="rail-note"><ShieldCheck size={14} /> Unsubscribed addresses are automatically excluded.</div></section>

            <section className="rail-card" id="drafts"><div className="rail-heading"><span><FileText size={16} /> RECENT DRAFTS</span><button className="icon-button" type="button" title="Start a new draft" aria-label="Start a new draft" onClick={startNewDraft}><FileText size={15} /></button></div>
              {loading ? <div className="rail-empty"><LoaderCircle className="spin" size={16} /> Loading drafts…</div> : drafts.length ? <div className="rail-list">{drafts.slice(0, 5).map((draft) => <button className={`rail-list-item ${draft.id === draftId ? "is-current" : ""}`} type="button" key={draft.id} onClick={() => void loadDraft(draft.id)}><span className="rail-list-title">{draft.subject || "Untitled newsletter"}</span><span className="rail-list-date">{formatDate(draft.updated_at)}</span></button>)}</div> : <div className="rail-empty">Your saved drafts will appear here.</div>}
            </section>

            <section className="rail-card" id="campaigns"><div className="rail-heading"><span><Send size={15} /> RECENT CAMPAIGNS</span><button className="icon-button" type="button" title="Refresh campaign list" aria-label="Refresh campaign list" onClick={() => void refreshBroadcasts()}><RefreshCw size={14} /></button></div>
              {broadcasts.length ? <div className="rail-list">{broadcasts.slice(0, 5).map((campaign) => <div className="campaign-item" key={campaign.id}><span className={`campaign-status status-${campaign.status}`}>{campaign.status}</span><span className="rail-list-title">{campaign.subject_snapshot}</span><span className="rail-list-date">{campaign.recipient_count.toLocaleString()} recipients · {formatDate(campaign.created_at)}</span>{campaign.status === "queued" || campaign.status === "sending" ? <button className="text-action" type="button" disabled={processing} onClick={() => void processBroadcast(campaign.id)}><Play size={13} /> Resume delivery</button> : null}{campaign.status === "partial" || campaign.status === "failed" ? <button className="text-action" type="button" disabled={processing} onClick={() => void retryBroadcast(campaign.id)}><RefreshCw size={13} /> Retry failed recipients</button> : null}</div>)}</div> : <div className="rail-empty">No newsletters have been sent yet.</div>}
            </section>

            {activeBroadcastId && progress ? (
              <section className="rail-card progress-card" aria-live="polite"><div className="rail-heading"><span><Clock3 size={15} /> DELIVERY PROGRESS</span><span className="progress-percent">{progress.total ? Math.round(((progress.sent + progress.failed + progress.skipped) / progress.total) * 100) : 0}%</span></div><div className="progress-track"><span style={{ width: `${progress.total ? Math.round(((progress.sent + progress.failed + progress.skipped) / progress.total) * 100) : 0}%` }} /></div><div className="progress-counts"><span><strong>{progress.sent}</strong> sent</span><span><strong>{progress.pending + progress.sending}</strong> remaining</span><span><strong>{progress.failed}</strong> failed</span></div>{processing ? <button className="button button-quiet button-small full-width" type="button" onClick={() => { stopAfterChunk.current = true; }}><Pause size={14} /> Pause after this batch</button> : progress.pending > 0 || progress.sending > 0 ? <button className="button button-primary button-small full-width" type="button" onClick={() => void processBroadcast(activeBroadcastId)}><Play size={14} /> Resume delivery</button> : null}</section>
            ) : null}
          </aside>
        </div>
      </main>

      {modalOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !preparing && !processing) setModalOpen(false); }}>
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="send-confirm-title">
            <button className="icon-button modal-close" type="button" aria-label="Close" onClick={() => setModalOpen(false)}><X size={18} /></button>
            <span className="modal-icon"><Send size={20} /></span>
            <p className="modal-kicker">FINAL DELIVERY REVIEW</p>
            <h2 id="send-confirm-title">{prepared ? "Ready for your confirmation" : "Review before you send"}</h2>
            <p className="modal-description">This newsletter will be sent to active subscribers who opted in. Unsubscribed addresses are excluded and every email includes a one-click unsubscribe link.</p>
            <div className="send-summary"><div><span>SUBJECT</span><strong>{prepared?.subject ?? subject ?? "—"}</strong></div><div><span>RECIPIENTS</span><strong>{prepared ? prepared.recipientCount.toLocaleString() : subscriberCount === null ? "Loading…" : `${subscriberCount.toLocaleString()} active subscribers`}</strong></div><div><span>ATTACHMENTS</span><strong>{prepared ? prepared.attachments.length ? prepared.attachments.map((file) => `${file.filename} (${formatBytes(file.sizeBytes)})`).join(", ") : "None" : attachments.length ? attachments.map((file) => `${file.filename} (${formatBytes(file.sizeBytes)})`).join(", ") : "None selected"}</strong></div></div>
            {prepared ? <div className="confirmation-stamp"><Check size={16} /> Exact recipient snapshot saved. No email has been sent yet.</div> : null}
            <div className="modal-actions"><button className="button button-quiet" type="button" disabled={preparing} onClick={() => setModalOpen(false)}>Cancel</button>{prepared ? <button className="button button-send" type="button" disabled={preparing || processing} onClick={() => void confirmPreparedBroadcast()}><Send size={16} /> Confirm &amp; send to {prepared.recipientCount.toLocaleString()}</button> : <button className="button button-primary" type="button" disabled={preparing || subscriberCount === 0} onClick={() => void prepareBroadcast()}>{preparing ? <LoaderCircle className="spin" size={16} /> : <Users size={16} />}{preparing ? "Preparing snapshot…" : "Snapshot audience & review"}</button>}</div>
            <p className="modal-footnote"><ShieldCheck size={13} /> Delivery is recorded per subscriber and can resume after interruption.</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
