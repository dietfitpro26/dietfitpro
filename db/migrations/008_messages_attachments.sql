-- 008: messaging — attachments storage + extra columns

alter table public.messages
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

-- Bucket for message attachments (private; signed URLs via API)
insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;

-- Authenticated users can upload into a folder named after their uid
drop policy if exists "msg_attach_insert_own" on storage.objects;
create policy "msg_attach_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can read attachments they uploaded
drop policy if exists "msg_attach_select_own" on storage.objects;
create policy "msg_attach_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Recipients can also read attachments referenced in messages they received
drop policy if exists "msg_attach_select_recipient" on storage.objects;
create policy "msg_attach_select_recipient" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and exists (
      select 1 from public.messages m
      where m.attachment_url like '%' || storage.objects.name || '%'
        and (m.recipient_id = auth.uid() or m.sender_id = auth.uid())
    )
  );

-- Owners can delete their own attachments
drop policy if exists "msg_attach_delete_own" on storage.objects;
create policy "msg_attach_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
