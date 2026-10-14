-- Bücher aus Teilen: Kapitel und ihre Teil-Artikel (T-108, E-028, E-029).
--
-- Ein Buch oder Abenteuer besteht aus Kapiteln (`Chapter`, die
-- Lesestruktur), ein Kapitel aus Teilen — Überschriften (`Heading`),
-- Absätzen (`Paragraph`), Vorlesetexten (`ReadAloudText`) und Verweisen auf
-- Artikel, die für sich stehen (`Embed`), alle unter dem abstrakten Obertyp
-- `BookPart`. Die Reihenfolge steht an der Kante `partOf` als `rank`, damit
-- derselbe Teil im Kapitel und in einem eigenen Arc an verschiedener
-- Stelle stehen darf. `chapterOf` sagt, welcher Arc dasselbe Kapitel aus
-- Geschichtssicht ist.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommen die Zeilen
-- hier nach — **nur, wo schon ein Register steht** (wie 040, 041).
-- Entfernt wird nichts: `partOf` bekommt Quell- und Zielarten und eine
-- Eigenschaft dazu.

insert into interface_def (name, label, abstract, extends, schema, area)
select v.* from (values
  ('Chapter', 'Chapter', false, array['Identity','Prose','Description','Visibility','Tags','Source','Notes'],
   '{"type":"object","properties":{"ordinal":{"type":"string","title":"Ordinal"}}}'::json, null),
  ('BookPart', 'Book part', true, array['Identity','Visibility','Tags','Source','Notes'],
   null::json, null),
  ('Heading', 'Heading', false, array['BookPart'],
   '{"type":"object","properties":{"level":{"type":"number","title":"Level","min":1,"max":6,"default":2}}}'::json, null),
  ('Paragraph', 'Paragraph', false, array['BookPart','Prose'],
   '{"type":"object","properties":{"kind":{"type":"string","title":"Kind","enum":["text","list","table","sidebar","quote"],"default":"text"}}}'::json, null),
  ('ReadAloudText', 'Read-aloud text', false, array['BookPart','ReadAloud'],
   null, null),
  ('Embed', 'Embedded article', false, array['BookPart'],
   '{"type":"object","required":["target"],"properties":{"target":{"type":"string","format":"link","title":"Article","target":{"interfaces":["Identity"]}}}}'::json, null)
) as v(name, label, abstract, extends, schema, area)
where exists (select 1 from interface_def)
on conflict (name) do nothing;

insert into relation_def (type, label, inverse_label, from_ifaces, to_ifaces, owned, cardinality, props)
select 'chapterOf', 'chapter of', 'read as chapter', '{Chapter}', '{Story}', false, 'one', '{}'::jsonb
where exists (select 1 from relation_def)
on conflict (type) do nothing;

update relation_def set from_ifaces = array_append(from_ifaces, 'Chapter')
 where type = 'partOf' and not ('Chapter' = any(from_ifaces)) and not ('*' = any(from_ifaces));
update relation_def set from_ifaces = array_append(from_ifaces, 'BookPart')
 where type = 'partOf' and not ('BookPart' = any(from_ifaces)) and not ('*' = any(from_ifaces));
update relation_def set to_ifaces = array_append(to_ifaces, 'Chapter')
 where type = 'partOf' and not ('Chapter' = any(to_ifaces)) and not ('*' = any(to_ifaces));

update relation_def
   set props = '{"type":"object","properties":{"rank":{"type":"number","title":"Order"}}}'::jsonb
 where type = 'partOf' and (props = '{}'::jsonb or props is null);
update relation_def
   set props = jsonb_set(props, '{properties,rank}', '{"type":"number","title":"Order"}'::jsonb)
 where type = 'partOf'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not (props -> 'properties' ? 'rank');
