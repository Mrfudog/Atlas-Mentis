-- Filtergruppen je Seite (T-137): benannte, gespeicherte Filter einer
-- Listenseite (Kompendium, World, Story, Rules), als Unterreiter gezeigt
-- und aus der Kopfleiste direkt aufrufbar.
--
-- Eine Gruppe gehört **entweder** der Kampagne (die Leitung pflegt sie,
-- jedes Mitglied sieht sie) **oder** einem Konto (nur seine). Die Vorgabe
-- einer Seite — „World ohne Items" — ist eine Gruppe der Kampagne mit
-- `is_default`, je Kampagne und Seite höchstens eine.
--
-- Kein Artikel und kein Registerteil: eine Konto-Id wandert nicht mit der
-- Ausfuhr (REQ-199), und wie jemand seine Listen schneidet, ist keine
-- Regel. Kein Fremdschlüssel auf die Kampagne — sie ist ein Artikel; geht
-- sie, bleiben die Zeilen stehen und zeigen nirgends mehr hin. Mit dem
-- Konto gehen seine Gruppen (`on delete cascade`).
create table if not exists list_filter (
  id          text primary key,
  page        text not null,
  name        text not null,
  campaign_id text,
  user_id     text references app_user(id) on delete cascade,
  filter      jsonb not null default '{}'::jsonb,
  is_default  boolean not null default false,
  rank        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check ((campaign_id is null) <> (user_id is null)),
  check (not is_default or campaign_id is not null)
);

create index if not exists list_filter_campaign on list_filter (campaign_id) where campaign_id is not null;
create index if not exists list_filter_user on list_filter (user_id) where user_id is not null;
create unique index if not exists list_filter_default on list_filter (campaign_id, page) where is_default;
