-- =====================================================================
-- Tarikh — schéma Supabase (Postgres). IDEMPOTENT : peut être relancé sans risque.
-- À copier-coller dans Supabase > SQL Editor > New query > Run.
-- Ensuite, exécuter supabase/seed.sql.
-- =====================================================================

-- ---------- Contenus quotidiens ----------
create table if not exists public.daily_stories (
  id          bigint generated always as identity primary key,
  date        date        not null,
  lang        text        not null check (lang in ('fr','en','ar','es','id','ur')),
  title       text        not null,
  era         text,
  period      text,
  teaser      text,
  story       text        not null,
  lesson      text        not null,
  topic_key   text        not null,
  category    text,
  origin      text        not null default 'ai' check (origin in ('ai','seed','manual')),
  created_at  timestamptz not null default now(),
  unique (date, lang)
);
create index if not exists daily_stories_lang_date_idx on public.daily_stories (lang, date desc);

-- Anti-doublon : un sujet n'est publié qu'une seule fois.
create table if not exists public.story_topics (
  topic_key    text primary key,
  category     text,
  title_en     text,
  origin       text not null default 'ai' check (origin in ('ai','seed','manual')),
  published_on date,
  created_at   timestamptz not null default now()
);

create table if not exists public.daily_reminders (
  id         bigint generated always as identity primary key,
  date       date not null,
  lang       text not null check (lang in ('fr','en','ar','es','id','ur')),
  hadith_id  text not null,
  arabic     text,
  text       text not null,
  narrator   text,
  source     text not null,
  created_at timestamptz not null default now(),
  unique (date, lang)
);

-- Suivi des passages du cron (pour n'envoyer la notification qu'une fois par jour).
create table if not exists public.cron_runs (
  date        date primary key,
  stories     int not null default 0,
  notified_at timestamptz,
  detail      jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------- Contenu Premium ----------
create table if not exists public.prophets (
  slug    text not null,
  lang    text not null check (lang in ('fr','en','ar','es','id','ur')),
  ord     int  not null,
  name    text not null,
  name_ar text,
  title   text,
  story   text not null,
  lesson  text,
  refs    jsonb not null default '[]'::jsonb,
  primary key (slug, lang)
);

-- kind : 'hajj' | 'quiz' | 'days'
create table if not exists public.premium_content (
  kind       text not null,
  lang       text not null check (lang in ('fr','en','ar','es','id','ur')),
  payload    jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (kind, lang)
);

-- ---------- Utilisateurs (compte optionnel) ----------
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  lang       text,
  created_at timestamptz not null default now()
);

-- Lien entre un appareil (identifiant anonyme = App User ID RevenueCat) et un compte.
create table if not exists public.device_links (
  app_user_id text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists device_links_user_idx on public.device_links (user_id);

-- Source de vérité unique des abonnements (Stripe pour le web, Apple via RevenueCat pour iOS).
create table if not exists public.subscriptions (
  id                   bigint generated always as identity primary key,
  user_id              uuid references auth.users (id) on delete set null,
  app_user_id          text,
  source               text not null check (source in ('stripe','apple')),
  external_id          text not null,
  status               text not null,
  product_id           text,
  current_period_end   timestamptz,
  trial_end            timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id   text,
  environment          text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (source, external_id)
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
create index if not exists subscriptions_app_user_idx on public.subscriptions (app_user_id);

create table if not exists public.favorites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  topic_key  text not null,
  lang       text not null,
  story      jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_key, lang)
);

-- Idempotence des webhooks : chaque événement n'est traité qu'une fois.
create table if not exists public.webhook_events (
  source      text not null,
  event_id    text not null,
  received_at timestamptz not null default now(),
  primary key (source, event_id)
);

-- ---------- Fonctions ----------
-- Abonnement actif ou en essai pour un utilisateur et/ou un appareil donné (usage serveur).
create or replace function public.is_premium_for(p_user_id uuid, p_app_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.status in ('active', 'trialing', 'grace')
      and (s.current_period_end is null or s.current_period_end > now() - interval '1 day')
      and (
        (p_user_id is not null and s.user_id = p_user_id)
        or (p_app_user_id is not null and s.app_user_id = p_app_user_id)
        or (p_user_id is not null and s.app_user_id in (select d.app_user_id from public.device_links d where d.user_id = p_user_id))
        or (p_app_user_id is not null and s.user_id in (select d.user_id from public.device_links d where d.app_user_id = p_app_user_id))
      )
  );
$$;

-- Abonnement de l'utilisateur connecté (utilisé par les règles RLS).
create or replace function public.is_premium()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public.is_premium_for(auth.uid(), null);
$$;

revoke all on function public.is_premium_for(uuid, text) from public, anon, authenticated;
grant execute on function public.is_premium_for(uuid, text) to service_role;
grant execute on function public.is_premium() to anon, authenticated, service_role;

-- ---------- Sécurité : RLS partout ----------
alter table public.daily_stories   enable row level security;
alter table public.story_topics    enable row level security;
alter table public.daily_reminders enable row level security;
alter table public.cron_runs       enable row level security;
alter table public.prophets        enable row level security;
alter table public.premium_content enable row level security;
alter table public.profiles        enable row level security;
alter table public.device_links    enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.favorites       enable row level security;
alter table public.webhook_events  enable row level security;

-- Histoire et rappel du jour : lecture publique (fenêtre de ±1 jour pour couvrir tous les fuseaux horaires).
-- L'historique complet est réservé aux abonnés.
drop policy if exists "daily_stories_read" on public.daily_stories;
create policy "daily_stories_read" on public.daily_stories for select to anon, authenticated
  using (date between (current_date - 1) and (current_date + 1) or (date < current_date and public.is_premium()));

drop policy if exists "daily_reminders_read" on public.daily_reminders;
create policy "daily_reminders_read" on public.daily_reminders for select to anon, authenticated
  using (date between (current_date - 1) and (current_date + 1) or (date < current_date and public.is_premium()));

-- Contenu Premium : abonnés uniquement.
drop policy if exists "prophets_premium_read" on public.prophets;
create policy "prophets_premium_read" on public.prophets for select to authenticated using (public.is_premium());

drop policy if exists "premium_content_read" on public.premium_content;
create policy "premium_content_read" on public.premium_content for select to authenticated using (public.is_premium());

-- Données personnelles : chacun ne voit que les siennes.
drop policy if exists "profiles_own_select" on public.profiles;
create policy "profiles_own_select" on public.profiles for select to authenticated using (user_id = auth.uid());
drop policy if exists "profiles_own_insert" on public.profiles;
create policy "profiles_own_insert" on public.profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "profiles_own_update" on public.profiles;
create policy "profiles_own_update" on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "device_links_own_select" on public.device_links;
create policy "device_links_own_select" on public.device_links for select to authenticated using (user_id = auth.uid());

drop policy if exists "subscriptions_own_select" on public.subscriptions;
create policy "subscriptions_own_select" on public.subscriptions for select to authenticated using (user_id = auth.uid());

drop policy if exists "favorites_own_select" on public.favorites;
create policy "favorites_own_select" on public.favorites for select to authenticated using (user_id = auth.uid());
drop policy if exists "favorites_own_insert" on public.favorites;
create policy "favorites_own_insert" on public.favorites for insert to authenticated with check (user_id = auth.uid() and public.is_premium());
drop policy if exists "favorites_own_delete" on public.favorites;
create policy "favorites_own_delete" on public.favorites for delete to authenticated using (user_id = auth.uid());

-- Aucune règle d'écriture pour anon/authenticated sur les autres tables :
-- seules les fonctions serveur (clé service_role, qui contourne RLS) peuvent écrire.
-- story_topics, cron_runs et webhook_events n'ont aucune règle : invisibles pour les clients.

-- Ceinture et bretelles : on retire aussi les droits d'écriture directs.
revoke insert, update, delete, truncate on public.daily_stories, public.story_topics, public.daily_reminders, public.cron_runs,
  public.prophets, public.premium_content, public.subscriptions, public.device_links, public.webhook_events from anon, authenticated;
revoke all on public.story_topics, public.cron_runs, public.webhook_events from anon, authenticated;
