-- Drei Sachen auf einmal, weil sie dieselbe Frage beantworten: wo steht
-- etwas, und wie oft.
--
-- 1. **Die Zahlen wohnen am Statblock**, auch die eines Spielercharakters.
--    Eine Kreatur trug ihre `StatblockInfo` bisher entweder selbst oder
--    geliehen, und der Bogen las „erst die eigene, dann die geliehene" —
--    zwei Formen für dasselbe. Die Wanderung der Werte macht
--    `prototype/migration/zahlen-an-den-statblock.mjs`.
-- 2. **`KnowledgeLevel` wird `Knowledge`**: kein Wissensstand mehr, dem
--    Figuren angehören, sondern ein Bündel von Informationen, das über
--    dieselbe `knownBy`-Kante zugeteilt wird. Der Stand war ein zweiter Weg
--    zu „wer weiss das" — Party und Group konnten schon Empfänger sein —
--    und in zwei Jahren hat ihn niemand benutzt.
-- 3. **`Imported` und `Image.url` fallen weg.** Die Importer sind weg, und
--    woher ein Bild stammt, gehört ans Asset: das ist ein Artikel und erbt
--    `Source`.

-- Ein Statblock je Kreatur, die ihre Zahlen selbst trug und keinen hat.
-- Die Nummer zählt hinter den vorhandenen weiter.
with ohne as (
  select c.entity_id, c.payload, e.created_at,
         row_number() over (order by e.created_at, c.entity_id) as n
  from component c
  join entity e on e.id = c.entity_id
  join component m on m.entity_id = c.entity_id and m.type = '__meta'
  where c.type = 'StatblockInfo'
    and m.payload -> 'interfaces' ->> 0 <> 'Statblock'
    and not exists (select 1 from relation r where r.type = 'belongsTo' and r.to_id = c.entity_id)
), hoch as (
  select coalesce(max((regexp_match(i.payload ->> 'id', '^statblock-(\d+)$'))[1]::int), 0) as bis
  from component i
  join component m2 on m2.entity_id = i.entity_id and m2.type = '__meta'
  where i.type = 'Identity' and m2.payload -> 'interfaces' ->> 0 = 'Statblock'
), neu as (
  insert into entity (id)
  select 'sb_' || o.entity_id from ohne o
  returning id
)
select count(*) from neu;

insert into component (entity_id, type, payload)
select 'sb_' || o.entity_id, '__meta', jsonb_build_object('interfaces', '["Statblock"]'::jsonb, 'adhoc', '[]'::jsonb)
from (select c.entity_id from component c
      join component m on m.entity_id = c.entity_id and m.type = '__meta'
      where c.type = 'StatblockInfo' and m.payload -> 'interfaces' ->> 0 <> 'Statblock'
        and not exists (select 1 from relation r where r.type = 'belongsTo' and r.to_id = c.entity_id)) o
on conflict (entity_id, type) do nothing;

insert into component (entity_id, type, payload)
select 'sb_' || c.entity_id, 'StatblockInfo', c.payload
from component c
join component m on m.entity_id = c.entity_id and m.type = '__meta'
where c.type = 'StatblockInfo' and m.payload -> 'interfaces' ->> 0 <> 'Statblock'
  and not exists (select 1 from relation r where r.type = 'belongsTo' and r.to_id = c.entity_id)
on conflict (entity_id, type) do nothing;

insert into relation (id, from_id, type, to_id, props, ord)
select 'rel_sb_' || c.entity_id, 'sb_' || c.entity_id, 'belongsTo', c.entity_id, '{}'::jsonb, 0
from component c
join component m on m.entity_id = c.entity_id and m.type = '__meta'
where c.type = 'StatblockInfo' and m.payload -> 'interfaces' ->> 0 <> 'Statblock'
on conflict (id) do nothing;

-- Und die Karte von der Kreatur weg. Wer schon einen geliehenen Statblock
-- hatte, verliert hier die zweite Fassung — das ist der Punkt.
delete from component c
using component m
where c.entity_id = m.entity_id and m.type = '__meta'
  and c.type = 'StatblockInfo' and m.payload -> 'interfaces' ->> 0 <> 'Statblock';

-- Der Wissensstand wird ein Bündel.
update component
set payload = jsonb_set(payload, '{interfaces}',
      (select coalesce(jsonb_agg(case when x = '"KnowledgeLevel"'::jsonb
                                      then '"Knowledge"'::jsonb else x end), '[]'::jsonb)
       from jsonb_array_elements(payload -> 'interfaces') x))
where type = '__meta' and payload -> 'interfaces' @> '["KnowledgeLevel"]'::jsonb;

delete from component where type = 'KnowledgeLevel';
delete from relation where type = 'atLevel';

-- Was mit den Importern wegfällt.
delete from component where type = 'Imported';
update component set payload = payload - 'url' where type = 'Image' and payload ? 'url';
delete from component where payload = '{}'::jsonb;

delete from interface_def where name in ('Imported', 'KnowledgeLevel');
delete from relation_def where type = 'atLevel';
