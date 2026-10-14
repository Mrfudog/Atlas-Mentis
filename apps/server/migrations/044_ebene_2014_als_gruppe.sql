-- „D&D 5e (2014)" wird die Gruppe der offiziellen 2014-Bücher (T-109,
-- REQ-249, auf E-017, E-022 b und T-094).
--
-- Die alte Sammelebene aus dem ersten Import (`e5_367c46d7f4ff`, Id aus
-- `layer|5e-2014`) hielt seit T-081 nur noch, was kein Buch nennt, hing an
-- keiner Herausgeber-Gruppe und hiess darum „Homebrew". Wo eine Kampagne
-- keine eigene Ebene hatte, war sie ausserdem deren Ebene (`campaignLayer`)
-- und bekam, was Spielende dort anlegten.
--
-- Was hier geschieht, in dieser Reihenfolge:
--  1. Eine Kampagne, deren Ebene die alte war, bekommt ihre eigene
--     (`ly_<kampagne>` wie Migration 035) — sonst würde mit der Gruppe das
--     oberste Buch ihre Ebene, und Spielende legten in ein Buch an.
--  2. Die neue Ebene „D&D 5e (2014) — no book given" (`e5_unsourced_2014`,
--     wie `ohneBuchEbeneId`) unter Official und in der Gruppe.
--  3. Die Artikel der alten Ebene ziehen um: was aus 5e.tools kam (Id
--     `e5_…`), in die neue Ebene; alles andere in die Ebene der Kampagne aus
--     1., wenn es genau eine gibt, sonst ebenfalls in die neue Ebene (und
--     wird gezählt).
--  4. Die alte Ebene wird eine Gruppe (`kind: 'group'`), Mitglieder sind
--     jede Ebene mit Regelstand 2014 unter Official.
--  5. **Keine Kampagne schaltet etwas anderes auf als vorher:** wer die alte
--     Ebene aufschaltete, bekäme jetzt jedes 2014-Buch dazu. Was davor nicht
--     im Spiel war (weder selbst aufgeschaltet noch über eine aufgeschaltete
--     Gruppe), wird an der Kampagne abgeschaltet (`activates`, `mode: 'off'`);
--     die Leitung schaltet es auf der Kampagnenseite an.
--
-- Gelöscht wird nichts. Fehlt die alte Ebene oder ist sie schon eine
-- Gruppe, tut die Migration nichts.

create temp table t109_alt on commit drop as
select e.id
  from entity e
  join component m on m.entity_id = e.id and m.type = '__meta' and m.payload->'interfaces'->>0 = 'Layer'
  join component l on l.entity_id = e.id and l.type = 'Layer'
 where e.id = 'e5_367c46d7f4ff'
   and coalesce(l.payload->>'kind', '') <> 'group';

-- 1. Kampagnen, deren Ebene die alte ist ------------------------------------

-- Was eine Kampagne aufschaltet, mit Stufe (Kante, sonst Ebene, sonst 10),
-- nur Ebenen, die keine Gruppe sind, keinem Konto gehören und die keine
-- andere Kampagne aufschaltet — die Kandidaten von `campaignLayer`.
create temp table t109_kandidat on commit drop as
select a.from_id as campaign,
       a.to_id as layer,
       coalesce(
         case when (a.props->>'order') ~ '^-?\d+(\.\d+)?$' then (a.props->>'order')::numeric end,
         case when (l.payload->>'order') ~ '^-?\d+(\.\d+)?$' then (l.payload->>'order')::numeric end,
         10) as stufe,
       a.ord
  from relation a
  join component cm on cm.entity_id = a.from_id and cm.type = '__meta' and cm.payload->'interfaces'->>0 = 'Campaign'
  join component lm on lm.entity_id = a.to_id and lm.type = '__meta' and lm.payload->'interfaces'->>0 = 'Layer'
  left join component l on l.entity_id = a.to_id and l.type = 'Layer'
 where exists (select 1 from t109_alt)
   and a.type = 'activates'
   and coalesce(a.props->>'mode', '') not in ('compare', 'off')
   and coalesce(l.payload->>'kind', '') <> 'group'
   and not exists (select 1 from app_user_layer g where g.layer_id = a.to_id and g.owner)
   and not exists (
     select 1 from relation b
       join component bm on bm.entity_id = b.from_id and bm.type = '__meta' and bm.payload->'interfaces'->>0 = 'Campaign'
      where b.type = 'activates' and b.to_id = a.to_id and b.from_id <> a.from_id
        and coalesce(b.props->>'mode', '') not in ('compare', 'off'));

-- Die oberste je Kampagne (Stufe, dann Reihenfolge der Kanten) ist ihre Ebene.
create temp table t109_kampagne on commit drop as
select k.campaign,
       coalesce(nullif(btrim(i.payload->>'name'), ''), k.campaign) as name
  from (select distinct on (campaign) campaign, layer
          from t109_kandidat
         order by campaign, stufe desc, ord desc) k
  left join component i on i.entity_id = k.campaign and i.type = 'Identity'
 where k.layer in (select id from t109_alt);

create temp table t109_kneu on commit drop as
select o.campaign,
       o.name,
       'ly_' || o.campaign as layer,
       'layer-' || lpad((coalesce((select max(substring(x.payload->>'id' from '^layer-(\d+)$')::int)
                                     from component x where x.type = 'Identity'), 0)
                         + row_number() over (order by o.name, o.campaign))::text, 4, '0') as nummer,
       coalesce((select max(k.stufe) from t109_kandidat k where k.campaign = o.campaign), 0) + 10 as stufe
  from t109_kampagne o
 where not exists (select 1 from entity e where e.id = 'ly_' || o.campaign);

insert into entity(id) select layer from t109_kneu;

insert into component(entity_id, type, payload)
select n.layer, k.type, k.payload
  from t109_kneu n
  cross join lateral (values
    ('Identity', jsonb_build_object('name', n.name, 'id', n.nummer, 'aliases', '[]'::jsonb)),
    ('Status',   jsonb_build_object('status', 'ready')),
    ('Layer',    jsonb_build_object('kind', 'campaign', 'order', 100)),
    ('Prose',    jsonb_build_object('paragraph', jsonb_build_array(jsonb_build_object(
                   'id', 'text',
                   'value', 'The layer of the campaign ' || n.name || '. Its GM and co-GMs edit what is in it; a version of an article from another layer lands here.')))),
    ('__meta',   jsonb_build_object('interfaces', jsonb_build_array('Layer'), 'adhoc', '[]'::jsonb))
  ) as k(type, payload);

insert into relation(id, from_id, to_id, type, props, ord)
select n.campaign || '~activates-' || n.layer,
       n.campaign,
       n.layer,
       'activates',
       jsonb_build_object('order', n.stufe),
       coalesce((select max(x.ord) from relation x where x.from_id = n.campaign), 0) + 1
  from t109_kneu n;

-- 2. Die Ebene für das, was kein Buch nennt -----------------------------------

create temp table t109_ohne on commit drop as
select 'e5_unsourced_2014'::text as id,
       'layer-' || lpad((coalesce((select max(substring(x.payload->>'id' from '^layer-(\d+)$')::int)
                                     from component x where x.type = 'Identity'), 0) + 1)::text, 4, '0') as nummer
 where exists (select 1 from t109_alt)
   and not exists (select 1 from entity e where e.id = 'e5_unsourced_2014');

insert into entity(id) select id from t109_ohne;

insert into component(entity_id, type, payload)
select o.id, k.type, k.payload
  from t109_ohne o
  cross join lateral (values
    ('Identity', jsonb_build_object('name', 'D&D 5e (2014) — no book given', 'id', o.nummer)),
    ('Status',   jsonb_build_object('status', 'ready')),
    ('Layer',    jsonb_build_object('kind', 'system', 'order', 0, 'version', '2014')),
    ('Prose',    jsonb_build_object('paragraph', jsonb_build_array(jsonb_build_object(
                   'id', 'text',
                   'value', 'What the 2014 rules of 5e.tools bring without naming a book (the action types). Every book has its own layer; which page an article comes from is in its source.')))),
    ('__meta',   jsonb_build_object('interfaces', jsonb_build_array('Layer'), 'adhoc', '[]'::jsonb))
  ) as k(type, payload);

insert into relation(id, from_id, to_id, type, props, ord)
select 'e5_unsourced_2014~partOf-' || g.id, 'e5_unsourced_2014', g.id, 'partOf', '{}'::jsonb, g.n
  from (values ('e5_publisher_official', 1), ('e5_367c46d7f4ff', 2)) as g(id, n)
 where exists (select 1 from t109_ohne)
   and exists (select 1 from entity x where x.id = g.id);

-- 3. Die Artikel ziehen um ----------------------------------------------------

create temp table t109_umzug on commit drop as
select r.id as kante,
       r.from_id as artikel,
       case
         when r.from_id like 'e5\_%' then 'e5_unsourced_2014'
         when (select count(*) from t109_kampagne) = 1 then (select 'ly_' || campaign from t109_kampagne)
         else 'e5_unsourced_2014'
       end as ziel
  from relation r
 where r.type = 'inLayer'
   and r.to_id in (select id from t109_alt);

update relation r
   set to_id = u.ziel
  from t109_umzug u
 where r.id = u.kante
   and exists (select 1 from entity x where x.id = u.ziel);

-- 4. Die alte Ebene wird eine Gruppe -------------------------------------------

update component
   set payload = payload || jsonb_build_object('kind', 'group', 'order', 0, 'version', '2014')
 where entity_id in (select id from t109_alt) and type = 'Layer';

update component
   set payload = jsonb_build_object('paragraph', jsonb_build_array(jsonb_build_object(
         'id', 'text',
         'value', 'The 2014 rules of the fifth edition, taken over from 5e.tools: a group of every official book built on them. Turning it on for a campaign puts every book in it into play; a single book inside can still be turned off.')))
 where entity_id in (select id from t109_alt) and type = 'Prose'
   -- nur der Text des Importers; einen eigenen lässt die Migration stehen
   and coalesce(payload#>>'{paragraph,0,value}', '') like 'The 2014 rules of the fifth edition%';

insert into component(entity_id, type, payload)
select a.id, 'Description', jsonb_build_object('description', 'Every official book of the 2014 rules.')
  from t109_alt a
 where not exists (select 1 from component c where c.entity_id = a.id and c.type = 'Description');

create temp table t109_mitglied on commit drop as
select e.id
  from entity e
  join component l on l.entity_id = e.id and l.type = 'Layer'
 where exists (select 1 from t109_alt)
   and e.id not in (select id from t109_alt)
   and l.payload->>'version' = '2014'
   and coalesce(l.payload->>'kind', '') <> 'group'
   and exists (select 1 from relation p where p.from_id = e.id and p.type = 'partOf' and p.to_id = 'e5_publisher_official')
   and not exists (select 1 from relation p where p.from_id = e.id and p.type = 'partOf' and p.to_id = 'e5_367c46d7f4ff');

insert into relation(id, from_id, to_id, type, props, ord)
select m.id || '~partOf-e5_367c46d7f4ff',
       m.id,
       'e5_367c46d7f4ff',
       'partOf',
       '{}'::jsonb,
       coalesce((select max(x.ord) from relation x where x.from_id = m.id), 0) + 1
  from t109_mitglied m;

-- 5. Was vorher nicht im Spiel war, bleibt aus ----------------------------------

-- Je Kampagne, die die alte Ebene aufschaltet: die Mitglieder, die sie
-- weder selbst aufschaltet (oder schon abschaltet) noch über eine andere
-- aufgeschaltete Gruppe bekam. Die neue Ebene aus 2. bringt, was vorher in
-- der alten lag, und bleibt an.
create temp table t109_aus on commit drop as
select a.from_id as campaign, m.id as layer
  from relation a
  join component cm on cm.entity_id = a.from_id and cm.type = '__meta' and cm.payload->'interfaces'->>0 = 'Campaign'
  cross join t109_mitglied m
 where a.type = 'activates'
   and a.to_id in (select id from t109_alt)
   and coalesce(a.props->>'mode', '') not in ('compare', 'off')
   and not exists (select 1 from relation s where s.from_id = a.from_id and s.type = 'activates' and s.to_id = m.id)
   and not exists (
     select 1 from relation g
       join relation p on p.from_id = m.id and p.type = 'partOf' and p.to_id = g.to_id
      where g.from_id = a.from_id and g.type = 'activates'
        and coalesce(g.props->>'mode', '') not in ('compare', 'off')
        and g.to_id not in (select id from t109_alt));

insert into relation(id, from_id, to_id, type, props, ord)
select x.campaign || '~activates-off-' || x.layer,
       x.campaign,
       x.layer,
       'activates',
       jsonb_build_object('mode', 'off'),
       coalesce((select max(y.ord) from relation y where y.from_id = x.campaign), 0)
         + row_number() over (partition by x.campaign order by x.layer)
  from t109_aus x;

-- Geändert heisst geschrieben: der Server liest den Bestand neu (`stempel`).
update entity set updated_at = now()
 where id in (select id from t109_alt)
    or id in (select layer from t109_kneu)
    or id in (select campaign from t109_kneu)
    or id in (select campaign from t109_aus)
    or id in (select id from t109_mitglied)
    or id in (select artikel from t109_umzug)
    or id = 'e5_unsourced_2014';

do $$
declare
  mitglieder int;
  ebenen int;
  umzug int;
  fremd int;
  aus int;
begin
  select count(*) into mitglieder from t109_mitglied;
  select count(*) into ebenen from t109_kneu;
  select count(*) into umzug from t109_umzug;
  select count(*) into fremd from t109_umzug where artikel not like 'e5\_%' and ziel = 'e5_unsourced_2014';
  select count(*) into aus from t109_aus;
  if exists (select 1 from t109_alt) then
    raise notice 'D&D 5e (2014) ist eine Gruppe: % Mitglieder, % Artikel umgezogen, % Kampagnenebene(n) neu, % Bücher abgeschaltet, wo sie vorher nicht im Spiel waren.',
      mitglieder, umzug, ebenen, aus;
  end if;
  if fremd > 0 then
    raise notice '% eigene Artikel ohne eindeutige Kampagne liegen jetzt in „D&D 5e (2014) — no book given".', fremd;
  end if;
end $$;
