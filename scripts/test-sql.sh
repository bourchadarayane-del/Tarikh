#!/usr/bin/env bash
# Teste supabase/schema.sql et supabase/seed.sql sur un Postgres local jetable :
# exécution deux fois (idempotence) puis vérification des règles de sécurité (RLS).
# Nécessite les binaires Postgres (initdb, pg_ctl, psql). Sans eux, le test est ignoré.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)
if [ -z "$BIN" ] || [ ! -x "$BIN/initdb" ]; then echo "SQL : Postgres local absent, test ignoré."; exit 0; fi
[ -f supabase/seed.sql ] || node scripts/build-seed.mjs >/dev/null

WORK=$(mktemp -d /tmp/tarikh-sql-XXXXXX)
PORT=54329
export PGOPTIONS="-c client_min_messages=warning"
RUN=""
if [ "$(id -u)" = "0" ]; then
  id postgres >/dev/null 2>&1 || { echo "SQL : utilisateur postgres absent, test ignoré."; exit 0; }
  chown -R postgres "$WORK"; RUN="runuser -u postgres --"
fi
cp supabase/schema.sql supabase/seed.sql "$WORK/"; chmod -R a+rX "$WORK"
$RUN "$BIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
$RUN "$BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
trap '$RUN "$BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
PSQL="$RUN $BIN/psql -h $WORK -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -d postgres"

# Imitation minimale de l'environnement Supabase (rôles, schéma auth, auth.uid()).
$PSQL <<'SQL'
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
SQL
for i in 1 2; do $PSQL -f "$WORK/schema.sql" >/dev/null; $PSQL -f "$WORK/seed.sql" >/dev/null; done
echo "SQL : schema.sql et seed.sql exécutés deux fois sans erreur (idempotents)."

$PSQL <<'SQL'
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'abonne@example.com'), ('22222222-2222-2222-2222-222222222222', 'gratuit@example.com');
insert into public.daily_stories (date, lang, title, story, lesson, topic_key) values
  (current_date, 'fr', 'Aujourd''hui', 's', 'l', 'today'), (current_date - 30, 'fr', 'Ancienne', 's', 'l', 'old'), (current_date + 5, 'fr', 'Future', 's', 'l', 'future');
insert into public.subscriptions (user_id, source, external_id, status, current_period_end) values
  ('11111111-1111-1111-1111-111111111111', 'stripe', 'sub_test', 'trialing', now() + interval '7 days');
insert into public.device_links (app_user_id, user_id) values ('device-linked', '22222222-2222-2222-2222-222222222222');
insert into public.subscriptions (app_user_id, source, external_id, status, current_period_end) values ('device-expired', 'apple', 'rc_old', 'active', now() - interval '10 days');

do $$
declare n int;
begin
  -- Les 25 prophètes et les contenus Premium existent dans les 6 langues.
  select count(*) into n from public.prophets; if n <> 150 then raise exception 'prophets: % lignes au lieu de 150', n; end if;
  select count(*) into n from public.premium_content; if n <> 18 then raise exception 'premium_content: % lignes au lieu de 18', n; end if;
  select count(*) into n from public.story_topics where origin = 'seed'; if n < 30 then raise exception 'story_topics: %', n; end if;

  -- Visiteur anonyme : histoire du jour seulement, aucun contenu Premium, aucune écriture.
  set local role anon;
  select count(*) into n from public.daily_stories; if n <> 1 then raise exception 'anon voit % histoires (attendu 1)', n; end if;
  select count(*) into n from public.prophets; if n <> 0 then raise exception 'anon voit les prophetes'; end if;
  select count(*) into n from public.premium_content; if n <> 0 then raise exception 'anon voit le contenu premium'; end if;
  begin insert into public.daily_stories (date, lang, title, story, lesson, topic_key) values (current_date, 'en', 'x', 'x', 'x', 'x'); raise exception 'anon a pu ecrire';
  exception when insufficient_privilege then null; end;
  begin select count(*) into n from public.subscriptions; if n <> 0 then raise exception 'anon voit des abonnements'; end if; exception when insufficient_privilege then null; end;
  begin perform 1 from public.webhook_events; raise exception 'anon lit webhook_events'; exception when insufficient_privilege then null; end;
  begin perform public.is_premium_for('11111111-1111-1111-1111-111111111111', null); raise exception 'anon appelle is_premium_for'; exception when insufficient_privilege then null; end;
  reset role;

  -- Utilisateur connecté sans abonnement.
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  set local role authenticated;
  if public.is_premium() then raise exception 'utilisateur gratuit considere premium'; end if;
  select count(*) into n from public.prophets; if n <> 0 then raise exception 'gratuit voit les prophetes'; end if;
  select count(*) into n from public.daily_stories; if n <> 1 then raise exception 'gratuit voit % histoires', n; end if;
  begin insert into public.favorites (user_id, topic_key, lang, story) values ('22222222-2222-2222-2222-222222222222', 't', 'fr', '{}'); raise exception 'gratuit a pu ajouter un favori';
  exception when insufficient_privilege then null; end;
  reset role;

  -- Abonné en période d'essai : tout le contenu Premium et l'historique, mais pas le futur ni les données des autres.
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  if not public.is_premium() then raise exception 'abonne non reconnu'; end if;
  select count(*) into n from public.prophets; if n <> 150 then raise exception 'abonne voit % prophetes', n; end if;
  select count(*) into n from public.daily_stories; if n <> 2 then raise exception 'abonne voit % histoires (attendu 2 : jour + historique)', n; end if;
  select count(*) into n from public.subscriptions; if n <> 1 then raise exception 'abonne voit % abonnements', n; end if;
  insert into public.favorites (user_id, topic_key, lang, story) values ('11111111-1111-1111-1111-111111111111', 't', 'fr', '{}');
  begin insert into public.favorites (user_id, topic_key, lang, story) values ('22222222-2222-2222-2222-222222222222', 't', 'fr', '{}'); raise exception 'favori ecrit pour un autre';
  exception when insufficient_privilege then null; end;
  begin update public.subscriptions set status = 'active', current_period_end = now() + interval '10 years'; raise exception 'abonne a modifie son abonnement';
  exception when insufficient_privilege then null; end;
  reset role;

  -- Fonction serveur : appareil relié, abonnement expiré.
  if public.is_premium_for(null, 'device-expired') then raise exception 'abonnement expire accepte'; end if;
  if public.is_premium_for(null, 'device-linked') then raise exception 'appareil sans abonnement accepte'; end if;
  update public.subscriptions set user_id = '22222222-2222-2222-2222-222222222222' where external_id = 'sub_test';
  if not public.is_premium_for(null, 'device-linked') then raise exception 'appareil relie au compte abonne refuse'; end if;
end $$;
SQL
echo "SQL : règles de sécurité vérifiées (anonyme, gratuit, abonné, appareil relié, expiration)."
