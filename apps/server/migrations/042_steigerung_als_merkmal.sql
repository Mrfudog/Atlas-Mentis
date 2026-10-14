-- Die Attributssteigerung als Merkmal mit eigener Wahl (T-107, E-027).
--
-- „Ability Score Improvement" ist ein Merkmal, das eine Klasse auf
-- mehreren Stufen gewährt (`grants` mit `props.level`, D50). Es trägt
-- seine Wahl jetzt selbst: Steigerung oder Talent (`improvement`, Sorte
-- `option`, Vorgabe Steigerung), dahinter +1 auf zwei Attribute, dasselbe
-- zweimal erlaubt (`repeat`), oder ein Talent (`onlyIf`). Die Figur
-- antwortet je Gewährung: `chose` merkt sich `by` (wer gewährt) und
-- `level`. Das gilt für jedes Merkmal, das mehrfach gewährt wird.
--
-- Hier kommt nach — **nur, wo schon ein Register steht** (wie 028, 038):
--  1. `Choices`: die Sorte `option` und die Angaben `repeat`, `onlyIf`,
--     `default` an einem Eintrag;
--  2. `Feature` nimmt `Choices` (ein Merkmal darf fragen);
--  3. `Campaign.feats` (Talente am Tisch, ohne Angabe ja);
--  4. `chose` trägt `by` und `level`;
--  5. die vorhandenen Attributssteigerungen nach 2014 (Name und Text wie
--     beim Importer, `ASI_WAHLEN`) bekommen die Wahl — nur, wo noch keine
--     Karte `Choices` steht. Eine Karte, die schon eine Wahl trägt, hat
--     jemand gefüllt und bleibt.
--
-- Entfernt wird nichts. Bestehende Antworten ohne `by`/`level` liest die
-- erste Gewährung (`choicesAtCharacter`).

-- 1. Choices --------------------------------------------------------------
update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,choices,entry,properties}',
     (schema::jsonb #> '{properties,choices,entry,properties}')
       || '{"repeat":{"type":"boolean","title":"Same pick more than once"},"onlyIf":{"type":"object","title":"Only if"},"default":{"type":"array","items":{"type":"string"},"title":"Default"}}'::jsonb
   )::json
 where name = 'Choices'
   and jsonb_typeof(schema::jsonb #> '{properties,choices,entry,properties}') = 'object'
   and not (schema::jsonb #> '{properties,choices,entry,properties}') ? 'repeat';

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,choices,entry,properties,kind,enum}',
     (schema::jsonb #> '{properties,choices,entry,properties,kind,enum}') || '["option"]'::jsonb
   )::json
 where name = 'Choices'
   and jsonb_typeof(schema::jsonb #> '{properties,choices,entry,properties,kind,enum}') = 'array'
   and not (schema::jsonb #> '{properties,choices,entry,properties,kind,enum}') ? 'option';

-- 2. Feature fragt -----------------------------------------------------------
update interface_def
   set extends = extends || array['Choices']
 where name = 'Feature' and not ('Choices' = any(extends))
   and exists (select 1 from interface_def where name = 'Choices');

-- 3. Talente am Tisch --------------------------------------------------------
update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,feats}',
     '{"type":"boolean","title":"Feats allowed","default":true}'::jsonb
   )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties' ? 'feats');

-- 4. Die Antwort kennt ihre Gewährung ---------------------------------------
update relation_def
   set props = jsonb_set(
     props,
     '{properties}',
     (props -> 'properties')
       || '{"by":{"type":"string","title":"Granted by"},"level":{"type":"number","min":1,"max":20,"title":"At level"}}'::jsonb
   )
 where type = 'chose'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not (props -> 'properties' ? 'by');

-- 5. Die vorhandenen Steigerungen -------------------------------------------
insert into component (entity_id, type, payload)
select m.entity_id, 'Choices',
       '{"choices":[{"id":"improvement","kind":"option","from":{"options":[{"key":"asi","label":"Increase ability scores"},{"key":"feat","label":"Take a feat instead"}]},"default":["asi"],"note":"Ability Score Improvement"},{"id":"ability-scores","kind":"ability","count":2,"bonus":[1,1],"repeat":true,"from":{"values":["str","dex","con","int","wis","cha"]},"onlyIf":{"choice":"improvement","pick":"asi"},"note":"+2 to one ability score or +1 to two"},{"id":"feat","kind":"feat","count":1,"from":{"interfaces":["Feat"]},"onlyIf":{"choice":"improvement","pick":"feat"},"note":"Feat"}]}'::jsonb
  from component m
  join component i on i.entity_id = m.entity_id and i.type = 'Identity'
  join component p on p.entity_id = m.entity_id and p.type = 'Prose'
 where m.type = '__meta'
   and m.payload->'interfaces'->>0 = 'Feature'
   and lower(i.payload->>'name') = 'ability score improvement'
   and p.payload::text ilike '%increase one ability score of your choice by 2%'
on conflict (entity_id, type) do nothing;
