-- Stücke im Inventar werden Instanzen ihres Gegenstands (T-150).
--
-- Die Leitung entschied am 14.10.: was den Spielern gegeben wird, entsteht
-- als Instanz des Artikels — wie ein Statblock aus einer Vorlage. Kauf
-- (T-133), Handwerk, Startausrüstung und „Add an item" legen neue Stücke
-- so an (`newInstance`, `stueck.ts`). Hier dasselbe für den Bestand:
--
-- Jede Kante `holds`, die direkt auf einen Gegenstand zeigt (keine Instanz,
-- `instanceOf` fehlt), bekommt ein eigenes Stück: ein neuer Artikel mit
-- `instanceOf` auf den Gegenstand, Name und Art des Gegenstands, eine
-- eigene Nummer, Stand `ready`, die Sichtbarkeit des Gegenstands, in den
-- Ebenen seines Inventars (das Stück
-- liegt, wo sein Inventar liegt). Die Kante zeigt danach auf das Stück und
-- behält alles, was sie trug — Menge, Platz im Raster, Drehung, und eine
-- Reservierung für einen Fertigungsauftrag (T-134): reserviert bleibt
-- reserviert. Wer das Inventar angelegt hat, hat auch das Stück angelegt
-- (`app_user_article`, D72).
--
-- Gelöscht wird nichts; der Gegenstand bleibt, wie er war. Je Kante ein
-- Stück — zwei Stapel desselben Gegenstands sind zwei Stücke.
--
-- **Bleibt und wird aufgezählt:**
-- - ein Gegenstand, der selbst ein Inventar trägt (`carries`, ein Behälter
--   mit Inhalt): er ist schon ein bestimmtes Stück, und sein Inhalt gehört
--   ihm und nicht einer Vorlage;
-- - ein Ziel, das kein Gegenstand ist (die Art steht nicht unter `Item`).

create temp table t150_kette on commit drop as
with recursive kette(name) as (
  select 'Item'::text
  union
  select d.name from interface_def d join kette k on k.name = any(d.extends)
)
select name from kette;

-- Alle Kanten `holds` auf etwas, das keine Instanz ist.
create temp table t150_alle on commit drop as
select h.id as kante,
       h.from_id as inventar,
       h.to_id as gegenstand,
       meta.payload->'interfaces' as interfaces,
       meta.payload->'interfaces'->>0 as art,
       coalesce(nullif(btrim(i.payload->>'name'), ''), h.to_id) as name,
       exists (select 1 from t150_kette k where k.name = meta.payload->'interfaces'->>0) as ist_gegenstand,
       exists (select 1 from relation c where c.from_id = h.to_id and c.type = 'carries') as traegt
  from relation h
  join component meta on meta.entity_id = h.to_id and meta.type = '__meta'
  left join component i on i.entity_id = h.to_id and i.type = 'Identity'
 where h.type = 'holds'
   and not exists (select 1 from relation x where x.from_id = h.to_id and x.type = 'instanceOf');

-- Die Nummer: das Präfix der Art (`idPrefix`) und die nächste freie je Präfix.
create temp table t150_neu on commit drop as
with umgestellt as (
  select a.*,
         coalesce(nullif(btrim(regexp_replace(lower(a.art), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'article') as praefix
    from t150_alle a
   where a.ist_gegenstand and not a.traegt
)
select u.kante,
       u.inventar,
       u.gegenstand,
       u.interfaces,
       u.name,
       'e_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) as stueck,
       u.praefix || '-' || lpad((coalesce((select max(substring(x.payload->>'id' from '^' || u.praefix || '-(\d+)$')::int)
                                             from component x where x.type = 'Identity'), 0)
                                 + row_number() over (partition by u.praefix order by u.inventar, u.kante))::text, 4, '0') as nummer
  from umgestellt u;

insert into entity(id) select stueck from t150_neu;

insert into component(entity_id, type, payload)
select n.stueck, k.type, k.payload
  from t150_neu n
  cross join lateral (values
    ('Identity', jsonb_build_object('name', n.name, 'id', n.nummer)),
    ('Status',   jsonb_build_object('status', 'ready')),
    ('__meta',   jsonb_build_object('interfaces', n.interfaces, 'adhoc', '[]'::jsonb))
  ) as k(type, payload);

-- Die Sichtbarkeit wird nicht vererbt (`NOT_INHERITED_CARDS`) — hier aber
-- mitgenommen: wer den verborgenen Gegenstand bisher nicht sah, sieht das
-- Stück jetzt nicht plötzlich. Die Leitung gibt es frei, wenn sie will.
insert into component(entity_id, type, payload)
select n.stueck, 'Visibility', v.payload
  from t150_neu n
  join component v on v.entity_id = n.gegenstand and v.type = 'Visibility';

insert into relation(id, from_id, to_id, type, props, ord)
select n.stueck || '~instanceOf', n.stueck, n.gegenstand, 'instanceOf', '{}'::jsonb, 0
  from t150_neu n;

insert into relation(id, from_id, to_id, type, props, ord)
select n.stueck || '~inLayer-' || row_number() over (partition by n.stueck order by l.ord, l.id),
       n.stueck,
       l.to_id,
       'inLayer',
       '{}'::jsonb,
       row_number() over (partition by n.stueck order by l.ord, l.id)
  from t150_neu n
  join relation l on l.from_id = n.inventar and l.type = 'inLayer';

insert into app_user_article(user_id, entity_id)
select a.user_id, n.stueck
  from t150_neu n
  join app_user_article a on a.entity_id = n.inventar
on conflict do nothing;

update relation r set to_id = n.stueck from t150_neu n where r.id = n.kante;

-- Geändert heisst geschrieben: der Server liest den Bestand neu (`stempel`),
-- und wer das Inventar noch im alten Stand offen hat, liest es neu.
update entity set updated_at = now(), revision = revision + 1
 where id in (select inventar from t150_neu);

do $$
declare
  neu int;
  behaelter text;
  fremd text;
begin
  select count(*) into neu from t150_neu;
  select string_agg(distinct name || ' (' || gegenstand || ')', ', ') into behaelter
    from t150_alle where ist_gegenstand and traegt;
  select string_agg(distinct name || ' (' || gegenstand || ', ' || coalesce(art, '?') || ')', ', ') into fremd
    from t150_alle where not ist_gegenstand;
  if neu > 0 then
    raise notice '% Stück(e) im Inventar als Instanz ihres Gegenstands angelegt', neu;
  end if;
  if behaelter is not null then
    raise notice 'Behälter mit eigenem Inhalt bleiben, wie sie sind: %', behaelter;
  end if;
  if fremd is not null then
    raise notice 'Im Inventar, aber kein Gegenstand — bleibt, wie es ist: %', fremd;
  end if;
end $$;
