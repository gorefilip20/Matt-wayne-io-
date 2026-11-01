-- Newsletter application schema. Safe to re-run; creates no public access policies.

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  consented_at timestamptz not null,
  consent_text text not null,
  consent_version text not null,
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  unsubscribe_token_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_subscribers_email_normalized check (email = lower(btrim(email))),
  constraint newsletter_subscribers_email_unique unique (email),
  constraint newsletter_subscribers_consent_text_nonempty check (length(btrim(consent_text)) > 0),
  constraint newsletter_subscribers_consent_version_nonempty check (length(btrim(consent_version)) > 0),
  constraint newsletter_subscribers_token_hash_nonempty check (length(btrim(unsubscribe_token_hash)) > 0)
);

create table if not exists public.newsletter_drafts (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  subject text not null,
  html_content text not null,
  attachment_ids uuid[] not null default '{}',
  created_by_open_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_drafts_prompt_nonempty check (length(btrim(prompt)) > 0),
  constraint newsletter_drafts_subject_nonempty check (length(btrim(subject)) > 0)
);

create table if not exists public.newsletter_attachments (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.newsletter_drafts(id) on delete cascade,
  storage_path text not null unique,
  sanitized_filename text not null,
  content_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  constraint newsletter_attachments_path_nonempty check (length(btrim(storage_path)) > 0),
  constraint newsletter_attachments_filename_sanitized check (
    length(btrim(sanitized_filename)) > 0 and sanitized_filename !~ '[/\\]' and sanitized_filename !~ '[[:cntrl:]]'
  ),
  constraint newsletter_attachments_content_type_allowed check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp')),
  constraint newsletter_attachments_size_valid check (size_bytes > 0 and size_bytes <= 20971520)
);

create table if not exists public.newsletter_broadcasts (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references public.newsletter_drafts(id) on delete set null,
  subject_snapshot text not null,
  html_snapshot text not null,
  attachment_ids uuid[] not null default '{}',
  app_origin text not null,
  recipient_count integer not null default 0,
  status text not null default 'queued' check (status in ('queued', 'sending', 'completed', 'partial', 'failed', 'cancelled')),
  created_by_open_id text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint newsletter_broadcasts_recipient_count_nonnegative check (recipient_count >= 0),
  constraint newsletter_broadcasts_subject_nonempty check (length(btrim(subject_snapshot)) > 0),
  constraint newsletter_broadcasts_progress_timestamps check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table if not exists public.newsletter_broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.newsletter_broadcasts(id) on delete cascade,
  subscriber_id uuid references public.newsletter_subscribers(id) on delete set null,
  email_snapshot text not null,
  unsubscribe_token_hash_snapshot text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint newsletter_broadcast_recipients_email_normalized check (email_snapshot = lower(btrim(email_snapshot))),
  constraint newsletter_broadcast_recipients_token_nonempty check (length(btrim(unsubscribe_token_hash_snapshot)) > 0),
  constraint newsletter_broadcast_recipients_attempts_nonnegative check (attempt_count >= 0),
  constraint newsletter_broadcast_recipients_campaign_email_unique unique (broadcast_id, email_snapshot)
);

create index if not exists newsletter_subscribers_status_idx on public.newsletter_subscribers (status);
create index if not exists newsletter_subscribers_created_at_idx on public.newsletter_subscribers (created_at desc);
create index if not exists newsletter_drafts_created_at_idx on public.newsletter_drafts (created_at desc);
create index if not exists newsletter_attachments_draft_id_idx on public.newsletter_attachments (draft_id);
create index if not exists newsletter_broadcasts_status_created_at_idx on public.newsletter_broadcasts (status, created_at desc);
create index if not exists newsletter_broadcast_recipients_broadcast_status_idx on public.newsletter_broadcast_recipients (broadcast_id, status);
create index if not exists newsletter_broadcast_recipients_subscriber_id_idx on public.newsletter_broadcast_recipients (subscriber_id);

alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_drafts enable row level security;
alter table public.newsletter_attachments enable row level security;
alter table public.newsletter_broadcasts enable row level security;
alter table public.newsletter_broadcast_recipients enable row level security;

-- Private bucket; access is intentionally not granted by this migration.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'newsletter-attachments',
  'newsletter-attachments',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;


-- Create the campaign and every recipient snapshot atomically. If any insert fails, the RPC
-- transaction rolls back the campaign and all recipients so no partial audience can be stranded.
create or replace function public.prepare_newsletter_broadcast_snapshot(
  p_draft_id uuid,
  p_subject_snapshot text,
  p_html_snapshot text,
  p_attachment_ids uuid[],
  p_app_origin text,
  p_created_by_open_id text
)
returns table (
  id uuid,
  subject_snapshot text,
  recipient_count integer,
  status text,
  attachment_ids uuid[],
  created_at timestamptz,
  attachments jsonb
)
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_broadcast_id uuid;
  v_recipient_count integer;
  v_attachment_ids uuid[] := coalesce(p_attachment_ids, '{}'::uuid[]);
  v_attachment_count integer;
begin
  perform d.id
  from public.newsletter_drafts d
  where d.id = p_draft_id
  for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'draft_not_found';
  end if;

  if cardinality(v_attachment_ids) > 8 then
    raise exception using errcode = 'P0001', message = 'draft_attachments_invalid';
  end if;
  if cardinality(v_attachment_ids) > 0 then
    perform a.id
    from public.newsletter_attachments a
    where a.draft_id = p_draft_id and a.id = any(v_attachment_ids)
    order by a.id
    for key share;
    select count(*) into v_attachment_count
    from public.newsletter_attachments a
    where a.draft_id = p_draft_id and a.id = any(v_attachment_ids);
    if v_attachment_count <> cardinality(v_attachment_ids) then
      raise exception using errcode = 'P0001', message = 'draft_attachments_invalid';
    end if;
  end if;

  insert into public.newsletter_broadcasts (
    draft_id, subject_snapshot, html_snapshot, attachment_ids, app_origin,
    recipient_count, status, created_by_open_id
  ) values (
    p_draft_id, p_subject_snapshot, p_html_snapshot, v_attachment_ids, p_app_origin,
    0, 'queued', p_created_by_open_id
  ) returning newsletter_broadcasts.id into v_broadcast_id;

  insert into public.newsletter_broadcast_recipients (
    broadcast_id, subscriber_id, email_snapshot, unsubscribe_token_hash_snapshot, status
  )
  select v_broadcast_id, s.id, s.email, s.unsubscribe_token_hash, 'pending'
  from public.newsletter_subscribers s
  where s.status = 'active'
  order by s.created_at, s.id;
  get diagnostics v_recipient_count = row_count;
  if v_recipient_count = 0 then
    raise exception using errcode = 'P0001', message = 'no_active_subscribers';
  end if;

  update public.newsletter_broadcasts b
  set recipient_count = v_recipient_count
  where b.id = v_broadcast_id;

  return query
  select b.id,
         b.subject_snapshot,
         b.recipient_count,
         b.status,
         b.attachment_ids,
         b.created_at,
         coalesce((
           select jsonb_agg(
             jsonb_build_object(
               'id', a.id,
               'filename', a.sanitized_filename,
               'contentType', a.content_type,
               'sizeBytes', a.size_bytes
             ) order by array_position(b.attachment_ids, a.id)
           )
           from public.newsletter_attachments a
           where a.draft_id = b.draft_id and a.id = any(b.attachment_ids)
         ), '[]'::jsonb)
  from public.newsletter_broadcasts b
  where b.id = v_broadcast_id;
end;
$function$;

revoke all on function public.prepare_newsletter_broadcast_snapshot(uuid, text, text, uuid[], text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_newsletter_broadcast_snapshot(uuid, text, text, uuid[], text, text)
  to service_role;
