-- =====================================================================
-- DietFitPro — Schéma initial complet (Supabase externe)
-- Migration 001 : tables, types, fonctions, triggers, RLS policies
-- =====================================================================
-- À exécuter dans l'éditeur SQL de TON projet Supabase
-- (Dashboard > SQL Editor > New query > coller ce fichier > Run)
-- Idempotent : peut être ré-exécuté sans casser l'existant.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('pro', 'patient', 'subscriber');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_plan as enum ('basic', 'premium', 'visio', 'patient');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('active', 'cancelled', 'past_due', 'trialing', 'none');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.meal_type as enum ('breakfast', 'lunch', 'snack', 'dinner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_channel as enum ('push', 'email', 'sms', 'in_app');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.feed_content_type as enum ('article', 'tip', 'recipe', 'challenge', 'video');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- TABLES
-- =====================================================================

-- 1. profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  role public.app_role not null default 'subscriber',
  locale text not null default 'fr',
  plan public.subscription_plan not null default 'basic',
  subscription_status public.subscription_status not null default 'none',
  stripe_customer_id text,
  stripe_subscription_id text,
  pro_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_pro_id_idx on public.profiles(pro_id);
create index if not exists profiles_role_idx on public.profiles(role);

-- 2. invitation_codes
create table if not exists public.invitation_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  pro_id uuid not null references public.profiles(id) on delete cascade,
  email text,
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);
create index if not exists invitation_codes_pro_id_idx on public.invitation_codes(pro_id);

-- 3. patients
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete cascade,
  pro_id uuid not null references public.profiles(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  birth_date date,
  gender text,
  phone text,
  email text,
  height_cm numeric(5,2),
  weight_kg numeric(5,2),
  target_weight_kg numeric(5,2),
  medical_notes text,
  allergies text[],
  preferences jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists patients_pro_id_idx on public.patients(pro_id);
create index if not exists patients_user_id_idx on public.patients(user_id);

-- 4. subscriber_overrides
create table if not exists public.subscriber_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, feature_key)
);

-- 5. nutrition_programs
create table if not exists public.nutrition_programs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  pro_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  start_date date not null default current_date,
  end_date date,
  daily_kcal_target int,
  daily_protein_g int,
  daily_carbs_g int,
  daily_fat_g int,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nutrition_programs_patient_idx on public.nutrition_programs(patient_id);

-- 6. recipes
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  name text not null,
  description text,
  image_url text,
  meal_type public.meal_type,
  prep_time_min int,
  servings int default 1,
  kcal_per_serving int,
  protein_g numeric(6,2),
  carbs_g numeric(6,2),
  fat_g numeric(6,2),
  ingredients jsonb default '[]'::jsonb,
  steps jsonb default '[]'::jsonb,
  tags text[],
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists recipes_created_by_idx on public.recipes(created_by);
create index if not exists recipes_public_idx on public.recipes(is_public);

-- 7. patient_recipes
create table if not exists public.patient_recipes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  meal_type public.meal_type,
  scheduled_date date,
  notes text,
  created_at timestamptz not null default now(),
  unique(patient_id, recipe_id, scheduled_date, meal_type)
);

-- 8. goals
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pro_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  target_value numeric,
  current_value numeric default 0,
  unit text,
  due_date date,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists goals_user_idx on public.goals(user_id);

-- 9. daily_logs
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null default current_date,
  meals jsonb default '[]'::jsonb,
  water_ml int default 0,
  steps int default 0,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  sleep_hours numeric(3,1),
  notes text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, log_date)
);
create index if not exists daily_logs_user_date_idx on public.daily_logs(user_id, log_date desc);

-- 10. body_measurements
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  measured_at date not null default current_date,
  weight_kg numeric(5,2),
  body_fat_pct numeric(4,1),
  muscle_mass_kg numeric(5,2),
  waist_cm numeric(5,1),
  hip_cm numeric(5,1),
  chest_cm numeric(5,1),
  arm_cm numeric(5,1),
  thigh_cm numeric(5,1),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists body_measurements_user_idx on public.body_measurements(user_id, measured_at desc);

-- 11. messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  attachment_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_thread_idx on public.messages(sender_id, recipient_id, created_at desc);
create index if not exists messages_recipient_idx on public.messages(recipient_id, read_at);

-- 12. ai_conversations
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  messages jsonb not null default '[]'::jsonb,
  escalated boolean not null default false,
  escalated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_conversations_user_idx on public.ai_conversations(user_id, updated_at desc);

-- 13. appointments
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references public.profiles(id) on delete cascade,
  patient_user_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  is_visio boolean not null default false,
  meeting_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_pro_idx on public.appointments(pro_id, starts_at);
create index if not exists appointments_patient_idx on public.appointments(patient_user_id, starts_at);

-- 14. sport_programs
create table if not exists public.sport_programs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  pro_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  exercises jsonb default '[]'::jsonb,
  frequency_per_week int,
  duration_min int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sport_programs_patient_idx on public.sport_programs(patient_id);

-- 15. scheduled_notifications
create table if not exists public.scheduled_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel public.notification_channel not null default 'push',
  title text not null,
  body text,
  payload jsonb default '{}'::jsonb,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists scheduled_notifications_due_idx on public.scheduled_notifications(scheduled_for) where sent_at is null;

-- 16. notification_logs
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel public.notification_channel not null,
  title text,
  body text,
  status text not null default 'sent',
  error text,
  sent_at timestamptz not null default now()
);
create index if not exists notification_logs_user_idx on public.notification_logs(user_id, sent_at desc);

-- 17. feed_content
create table if not exists public.feed_content (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  type public.feed_content_type not null default 'article',
  title text not null,
  body text,
  image_url text,
  video_url text,
  tags text[],
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists feed_content_published_idx on public.feed_content(is_published, published_at desc);

-- 18. feed_interactions
create table if not exists public.feed_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_id uuid not null references public.feed_content(id) on delete cascade,
  liked boolean not null default false,
  saved boolean not null default false,
  comment text,
  created_at timestamptz not null default now(),
  unique(user_id, content_id)
);

-- 19. weekly_challenges
create table if not exists public.weekly_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_on date not null,
  ends_on date not null,
  target_metric text,
  target_value numeric,
  reward_points int default 10,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 20. challenge_participations
create table if not exists public.challenge_participations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_id uuid not null references public.weekly_challenges(id) on delete cascade,
  progress numeric default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, challenge_id)
);

-- 21. visio_consultations
create table if not exists public.visio_consultations (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  pro_id uuid not null references public.profiles(id) on delete cascade,
  patient_user_id uuid not null references public.profiles(id) on delete cascade,
  room_url text not null,
  started_at timestamptz,
  ended_at timestamptz,
  duration_min int,
  recording_url text,
  notes text,
  stripe_payment_intent text,
  amount_cents int,
  created_at timestamptz not null default now()
);
create index if not exists visio_pro_idx on public.visio_consultations(pro_id);
create index if not exists visio_patient_idx on public.visio_consultations(patient_user_id);

-- 22. pro_availability
create table if not exists public.pro_availability (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint check (weekday between 0 and 6), -- 0 = dimanche
  start_time time not null,
  end_time time not null,
  is_visio boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists pro_availability_pro_idx on public.pro_availability(pro_id);

-- =====================================================================
-- FONCTIONS UTILITAIRES
-- =====================================================================

-- has_role : SECURITY DEFINER pour éviter récursion RLS sur profiles
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = _user_id and role = _role
  )
$$;

-- is_pro_of : vérifie qu'un pro est bien celui d'un patient donné
create or replace function public.is_pro_of(_pro_id uuid, _patient_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = _patient_user_id and pro_id = _pro_id
  )
$$;

-- updated_at trigger générique
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- handle_new_user : crée un profil après signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'subscriber')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Triggers updated_at
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'profiles','patients','nutrition_programs','goals','daily_logs',
      'ai_conversations','appointments','sport_programs'
    ])
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table public.profiles                enable row level security;
alter table public.invitation_codes        enable row level security;
alter table public.patients                enable row level security;
alter table public.subscriber_overrides    enable row level security;
alter table public.nutrition_programs      enable row level security;
alter table public.recipes                 enable row level security;
alter table public.patient_recipes         enable row level security;
alter table public.goals                   enable row level security;
alter table public.daily_logs              enable row level security;
alter table public.body_measurements       enable row level security;
alter table public.messages                enable row level security;
alter table public.ai_conversations        enable row level security;
alter table public.appointments            enable row level security;
alter table public.sport_programs          enable row level security;
alter table public.scheduled_notifications enable row level security;
alter table public.notification_logs       enable row level security;
alter table public.feed_content            enable row level security;
alter table public.feed_interactions       enable row level security;
alter table public.weekly_challenges       enable row level security;
alter table public.challenge_participations enable row level security;
alter table public.visio_consultations     enable row level security;
alter table public.pro_availability        enable row level security;

-- ---------- profiles ----------
drop policy if exists "profiles_select_self_or_pro" on public.profiles;
create policy "profiles_select_self_or_pro" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'pro'));

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (id = auth.uid() or public.has_role(auth.uid(), 'pro'));

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- ---------- invitation_codes ----------
drop policy if exists "invitations_pro_all" on public.invitation_codes;
create policy "invitations_pro_all" on public.invitation_codes
  for all to authenticated
  using (pro_id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (pro_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

drop policy if exists "invitations_select_by_code" on public.invitation_codes;
create policy "invitations_select_by_code" on public.invitation_codes
  for select to authenticated using (true);

-- ---------- patients ----------
drop policy if exists "patients_pro_all" on public.patients;
create policy "patients_pro_all" on public.patients
  for all to authenticated
  using (pro_id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (pro_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

drop policy if exists "patients_self_select" on public.patients;
create policy "patients_self_select" on public.patients
  for select to authenticated using (user_id = auth.uid());

-- ---------- subscriber_overrides ----------
drop policy if exists "overrides_self_or_pro" on public.subscriber_overrides;
create policy "overrides_self_or_pro" on public.subscriber_overrides
  for all to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

-- ---------- nutrition_programs ----------
drop policy if exists "programs_pro_all" on public.nutrition_programs;
create policy "programs_pro_all" on public.nutrition_programs
  for all to authenticated
  using (pro_id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (pro_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

drop policy if exists "programs_patient_select" on public.nutrition_programs;
create policy "programs_patient_select" on public.nutrition_programs
  for select to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()));

-- ---------- recipes ----------
drop policy if exists "recipes_select_public_or_own" on public.recipes;
create policy "recipes_select_public_or_own" on public.recipes
  for select to authenticated
  using (is_public = true or created_by = auth.uid() or public.has_role(auth.uid(), 'pro'));

drop policy if exists "recipes_pro_write" on public.recipes;
create policy "recipes_pro_write" on public.recipes
  for all to authenticated
  using (created_by = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (created_by = auth.uid() or public.has_role(auth.uid(), 'pro'));

-- ---------- patient_recipes ----------
drop policy if exists "patient_recipes_pro_all" on public.patient_recipes;
create policy "patient_recipes_pro_all" on public.patient_recipes
  for all to authenticated
  using (public.has_role(auth.uid(), 'pro'))
  with check (public.has_role(auth.uid(), 'pro'));

drop policy if exists "patient_recipes_self_select" on public.patient_recipes;
create policy "patient_recipes_self_select" on public.patient_recipes
  for select to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()));

-- ---------- goals ----------
drop policy if exists "goals_self_or_pro" on public.goals;
create policy "goals_self_or_pro" on public.goals
  for all to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

-- ---------- daily_logs ----------
drop policy if exists "logs_self_or_pro" on public.daily_logs;
create policy "logs_self_or_pro" on public.daily_logs
  for all to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

-- ---------- body_measurements ----------
drop policy if exists "measurements_self_or_pro" on public.body_measurements;
create policy "measurements_self_or_pro" on public.body_measurements
  for all to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

-- ---------- messages ----------
drop policy if exists "messages_participants" on public.messages;
create policy "messages_participants" on public.messages
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

drop policy if exists "messages_insert_self" on public.messages;
create policy "messages_insert_self" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid());

drop policy if exists "messages_update_recipient" on public.messages;
create policy "messages_update_recipient" on public.messages
  for update to authenticated
  using (recipient_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

-- ---------- ai_conversations ----------
drop policy if exists "ai_self_or_pro" on public.ai_conversations;
create policy "ai_self_or_pro" on public.ai_conversations
  for all to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

-- ---------- appointments ----------
drop policy if exists "appointments_participants" on public.appointments;
create policy "appointments_participants" on public.appointments
  for all to authenticated
  using (pro_id = auth.uid() or patient_user_id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (pro_id = auth.uid() or patient_user_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

-- ---------- sport_programs ----------
drop policy if exists "sport_pro_all" on public.sport_programs;
create policy "sport_pro_all" on public.sport_programs
  for all to authenticated
  using (pro_id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (pro_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

drop policy if exists "sport_patient_select" on public.sport_programs;
create policy "sport_patient_select" on public.sport_programs
  for select to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()));

-- ---------- scheduled_notifications ----------
drop policy if exists "scheduled_self_or_pro" on public.scheduled_notifications;
create policy "scheduled_self_or_pro" on public.scheduled_notifications
  for all to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

-- ---------- notification_logs ----------
drop policy if exists "notif_logs_self_or_pro" on public.notification_logs;
create policy "notif_logs_self_or_pro" on public.notification_logs
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

-- ---------- feed_content ----------
drop policy if exists "feed_select_published" on public.feed_content;
create policy "feed_select_published" on public.feed_content
  for select to authenticated
  using (is_published = true or author_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

drop policy if exists "feed_write_pro" on public.feed_content;
create policy "feed_write_pro" on public.feed_content
  for all to authenticated
  using (public.has_role(auth.uid(), 'pro'))
  with check (public.has_role(auth.uid(), 'pro'));

-- ---------- feed_interactions ----------
drop policy if exists "feed_interactions_self_or_pro" on public.feed_interactions;
create policy "feed_interactions_self_or_pro" on public.feed_interactions
  for all to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

-- ---------- weekly_challenges ----------
drop policy if exists "challenges_select_all" on public.weekly_challenges;
create policy "challenges_select_all" on public.weekly_challenges
  for select to authenticated using (true);

drop policy if exists "challenges_write_pro" on public.weekly_challenges;
create policy "challenges_write_pro" on public.weekly_challenges
  for all to authenticated
  using (public.has_role(auth.uid(), 'pro'))
  with check (public.has_role(auth.uid(), 'pro'));

-- ---------- challenge_participations ----------
drop policy if exists "participations_self_or_pro" on public.challenge_participations;
create policy "participations_self_or_pro" on public.challenge_participations
  for all to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

-- ---------- visio_consultations ----------
drop policy if exists "visio_participants" on public.visio_consultations;
create policy "visio_participants" on public.visio_consultations
  for all to authenticated
  using (pro_id = auth.uid() or patient_user_id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (pro_id = auth.uid() or patient_user_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

-- ---------- pro_availability ----------
drop policy if exists "availability_select_all" on public.pro_availability;
create policy "availability_select_all" on public.pro_availability
  for select to authenticated using (true);

drop policy if exists "availability_pro_write" on public.pro_availability;
create policy "availability_pro_write" on public.pro_availability
  for all to authenticated
  using (pro_id = auth.uid() or public.has_role(auth.uid(), 'pro'))
  with check (pro_id = auth.uid() or public.has_role(auth.uid(), 'pro'));

-- =====================================================================
-- FIN MIGRATION 001
-- =====================================================================
