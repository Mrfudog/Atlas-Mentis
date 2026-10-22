-- Wer einen Artikel hinzugefügt hat (T-382): die Übersichten filtern und
-- sortieren nach „Added by". `app_user_article` nennt nur, was Spielende
-- angelegt haben (D72) — und trägt ein Recht: wer dort steht, schreibt den
-- Artikel. Die Herkunft einer Zeile der Leitung oder Verwaltung ist keine
-- Berechtigung, darum eine eigene Tabelle, die nichts erlaubt.
--
-- Neben dem Konto und nicht im Artikel (REQ-199): eine Konto-Id in einem
-- Artikel wandert beim Export mit. Ohne Fremdschlüssel auf `entity`, wie
-- `app_user_article`: ein gelöschter Artikel, den Undo zurückbringt, soll
-- seine Herkunft behalten.
--
-- Nachgezogen wird, was schon bekannt ist: die erste Verfasserin aus
-- `app_user_article`, sonst `by` aus dem Ereignis `entity.created`. Was
-- beides nicht kennt (Seed, Einlesen, Anlegen der Verwaltung vor T-382),
-- bleibt ohne — die Liste zeigt dann „Unknown". Nichts wird entfernt.
-- Nummer beim Hereinmergen nachgesehen: 139 (138 hält der offene PR #359).

create table if not exists entity_creator (
  entity_id  text primary key,
  user_id    text not null references app_user(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists entity_creator_user on entity_creator(user_id);

insert into entity_creator(entity_id, user_id, created_at)
select distinct on (a.entity_id) a.entity_id, a.user_id, a.added_at
  from app_user_article a
 order by a.entity_id, a.added_at
on conflict (entity_id) do nothing;

insert into entity_creator(entity_id, user_id, created_at)
select distinct on (e.subject) e.subject, e.payload ->> 'by', e.at
  from event_log e
  join app_user u on u.id = e.payload ->> 'by'
 where e.name = 'entity.created'
   and e.subject is not null
 order by e.subject, e.at
on conflict (entity_id) do nothing;
