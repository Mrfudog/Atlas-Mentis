-- Ebenen nach Herausgeber und nach den Kategorien der 5e.tools-Blocklist
-- (T-094, REQ-249, auf T-088 und E-022 b).
--
-- Ein Herausgeber ist eine Gruppe wie eine Kategorie: eine Ebene mit
-- `Layer.kind: 'group'` und `Layer.groupBy: 'publisher'`, die Bücher hängen
-- mit `partOf` an ihr. Der Herausgeber einer Ebene wird gerechnet
-- (`publisherOf`); was an keinem hängt, ist Homebrew.
--
-- Hier kommt nach, was der Importer seit T-094 anlegt:
--  1. das Registerfeld `groupBy` (nur, wo schon ein Register steht);
--  2. die Gruppen „Official", „Partnered" (Herausgeber) und „Non-standard",
--     „Comedy", „Outside the Forgotten Realms" (Kategorien der Blocklist),
--     aber nur, wo eine Buchebene hineingehört — Ids wie
--     `herausgeberEbeneId` / `gruppeEbeneId`;
--  3. je Buchebene ihre Kanten dorthin. Einen Herausgeber bekommt nur ein
--     Buch, das noch an keinem hängt.
--
-- Die Listen sind die des Importers (packages/import-5etools/src/lauf.ts,
-- aus 5etools-src/js/parser.js), als Ebenen-Id geschrieben (`buchEbeneId`:
-- klein, alles ausser Buchstaben und Ziffern wird „-"). Gelöscht wird
-- nichts; keine Kampagne schaltet etwas anderes auf als vorher.

-- 1. Register --------------------------------------------------------------

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties}',
         '{"groupBy": {"type": "string", "title": "Groups by", "enum": ["category", "publisher"]}}'::jsonb
           || coalesce(schema::jsonb->'properties', '{}'::jsonb)
       )::json
 where name = 'Layer' and schema is not null;

-- 2. Die Gruppen ------------------------------------------------------------

create temp table t094_gruppe (id text primary key, name text, text text, verlag boolean, rang int) on commit drop;
insert into t094_gruppe values
  ('e5_group_nonstandard', 'Non-standard', 'Free web supplements, charity adventures, Plane Shift and crossovers: official, but outside the standard books (5e.tools: UA/Etc.).', false, 1),
  ('e5_group_comedy', 'Comedy', 'Books meant as a joke or a crossover for fun (5e.tools: Comedy Sources).', false, 2),
  ('e5_group_non-fr', 'Outside the Forgotten Realms', 'Books set in another world than the Forgotten Realms (5e.tools: Non-Forgotten Realms).', false, 3),
  ('e5_publisher_official', 'Official', 'Published by Wizards of the Coast.', true, 4),
  ('e5_publisher_partnered', 'Partnered', 'Made with a partner of Wizards of the Coast (Critical Role, Rick and Morty, LEGO …) and sold as official D&D.', true, 5);

create temp table t094_liste (gruppe text, slug text) on commit drop;
insert into t094_liste
select 'e5_group_nonstandard', unnest(array[
  'oga', 'llk', 'azfyt', 'lr', 'tlk', 'ttp', 'awm', 'imr', 'sads', 'mff', 'xmts', 'rtg', 'aitfr', 'aitfr-isf',
  'aitfr-thp', 'aitfr-avt', 'aitfr-dn', 'aitfr-fcd', 'dod', 'mabjov', 'nrh', 'nrh-tcmc', 'nrh-avitw', 'nrh-ass',
  'nrh-coi', 'nrh-tlt', 'nrh-awol', 'nrh-at', 'mgelft', 'vd', 'sja', 'hat-tg', 'hat-lmi', 'gotsf', 'mcv3mc',
  'mcv4ec', 'mismv1', 'lk', 'aatm', 'coa', 'pip', 'hfstcm', 'uthftlh', 'scoee', 'hbtd', 'bqgt', 'rwg'])
union all
select 'e5_group_comedy', unnest(array[
  'ai', 'oow', 'rmr', 'rmbre', 'hftt', 'awm', 'mgelft', 'hat-tg', 'hat-lmi', 'mcv3mc', 'mismv1', 'lk', 'pip',
  'lrdt', 'uthftlh', 'scoee', 'hbtd', 'bqgt', 'wtthc'])
union all
select 'e5_group_non-fr', unnest(array[
  'ggr', 'kkw', 'erlw', 'efr', 'egw', 'tor', 'dd', 'fs', 'us', 'mot', 'xmts', 'azfyt', 'scc', 'scc-ck', 'scc-hfmt',
  'scc-tmm', 'scc-arir', 'crcotn', 'sja', 'sais', 'aag', 'bam', 'lox', 'dsotdq', 'paitm', 'sato', 'tofw', 'mpp',
  'mcv4ec', 'lk', 'lrdt', 'uthftlh', 'scoee', 'hbtd', 'bqgt', 'wtthc', 'lfl', 'efa', 'ffotr'])
union all
select 'e5_publisher_partnered', unnest(array['rmbre', 'rmr', 'egw', 'tor', 'dd', 'fs', 'us', 'crcotn', 'hftt', 'lrdt', 'td']);

create temp table t094_buch on commit drop as
select e.id, substring(e.id from '^e5_book_(.+)$') as slug
  from entity e
  join component m on m.entity_id = e.id and m.type = '__meta' and m.payload->'interfaces'->>0 = 'Layer'
  join component l on l.entity_id = e.id and l.type = 'Layer'
 where l.payload->>'kind' in ('book', 'adventure')
   and e.id like 'e5_book_%';

-- Welches Buch in welche Gruppe: die Listen, Plane Shift und MCV als
-- Präfix, und jedes übrige Buch zu Official.
create temp table t094_roh on commit drop as
select b.id as buch, li.gruppe
  from t094_buch b join t094_liste li on li.slug = b.slug
union
select b.id, 'e5_group_nonstandard' from t094_buch b where b.slug ~ '^(ps|mcv)'
union
select b.id, 'e5_publisher_official' from t094_buch b
 where not exists (select 1 from t094_liste li where li.slug = b.slug and li.gruppe = 'e5_publisher_partnered');

-- Ein Buch, das schon an einem Herausgeber hängt (die Leitung hat es
-- umgehängt), bekommt keinen zweiten.
create temp table t094_kante on commit drop as
select k.buch, k.gruppe
  from t094_roh k
  join t094_gruppe g on g.id = k.gruppe
 where not g.verlag
    or not exists (
     select 1 from relation r
       join component l on l.entity_id = r.to_id and l.type = 'Layer'
      where r.from_id = k.buch and r.type = 'partOf' and r.to_id <> k.gruppe
        and l.payload->>'kind' = 'group' and l.payload->>'groupBy' = 'publisher');

create temp table t094_neu on commit drop as
select g.id,
       g.name,
       g.text,
       g.verlag,
       'layer-' || lpad((coalesce((select max(substring(c.payload->>'id' from '^layer-(\d+)$')::int)
                                     from component c where c.type = 'Identity'), 0)
                         + row_number() over (order by g.rang))::text, 4, '0') as nummer
  from t094_gruppe g
 where exists (select 1 from t094_kante k where k.gruppe = g.id)
   and not exists (select 1 from entity x where x.id = g.id);

insert into entity(id) select id from t094_neu;

insert into component(entity_id, type, payload)
select n.id, k.type, k.payload
  from t094_neu n
  cross join lateral (values
    ('Identity',    jsonb_build_object('name', n.name, 'id', n.nummer)),
    ('Status',      jsonb_build_object('status', 'ready')),
    ('Layer',       case when n.verlag
                      then jsonb_build_object('kind', 'group', 'order', 0, 'groupBy', 'publisher')
                      else jsonb_build_object('kind', 'group', 'order', 0) end),
    ('Description', jsonb_build_object('description', n.text)),
    ('Prose',       jsonb_build_object('paragraph', jsonb_build_array(jsonb_build_object(
                      'id', 'text',
                      'value', n.text || ' A group of layers from 5e.tools: turning it on for a campaign puts every book in it into play; a single book inside can still be turned off.')))),
    ('__meta',      jsonb_build_object('interfaces', jsonb_build_array('Layer'), 'adhoc', '[]'::jsonb))
  ) as k(type, payload);

-- 3. Die Kanten -------------------------------------------------------------

insert into relation(id, from_id, to_id, type, props, ord)
select k.buch || '~partOf-' || k.gruppe,
       k.buch,
       k.gruppe,
       'partOf',
       '{}'::jsonb,
       coalesce((select max(x.ord) from relation x where x.from_id = k.buch), 0)
         + row_number() over (partition by k.buch order by g.rang)
  from t094_kante k
  join t094_gruppe g on g.id = k.gruppe
 where exists (select 1 from entity x where x.id = k.gruppe)
   and not exists (select 1 from relation x where x.from_id = k.buch and x.type = 'partOf' and x.to_id = k.gruppe);

-- Geändert heisst geschrieben: der Server liest den Bestand neu (`stempel`).
update entity set updated_at = now()
 where id in (select buch from t094_kante) or id in (select id from t094_neu);

do $$
declare
  kanten int;
  gruppen int;
begin
  select count(*) into kanten from t094_kante;
  select count(*) into gruppen from t094_neu;
  if kanten > 0 then
    raise notice 'Herausgeber und Blocklist-Kategorien: % Kanten, % Gruppen neu.', kanten, gruppen;
  end if;
end $$;
