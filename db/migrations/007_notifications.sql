-- 007: notifications system (in-app + scheduled email reminders)

-- 1. Champs additionnels pour scheduled_notifications
alter table public.scheduled_notifications
  add column if not exists type text not null default 'generic',
  add column if not exists read_at timestamptz,
  add column if not exists link text;

create index if not exists scheduled_notifications_user_unread_idx
  on public.scheduled_notifications(user_id, created_at desc)
  where read_at is null;

create index if not exists scheduled_notifications_user_recent_idx
  on public.scheduled_notifications(user_id, created_at desc);
