-- Die Attributssteigerung der Gefolgsleute fragt auch (T-095, E-027).
--
-- Migration 042 gab dem Merkmal „Ability Score Improvement" nach 2014 seine
-- Wahl (Steigerung oder Talent, +1 auf zwei Attribute, dasselbe zweimal
-- erlaubt) und erkannte es am Satz „increase one ability score of your
-- choice by 2". Die Gefolgsleute (Sidekicks, TCE) sagen ihn in der dritten
-- Person — „the sidekick increases one …" — und blieben ohne Wahl: der
-- Aufstieg auf Stufe 4 fragte dort nichts. Der Importer erkennt beide
-- Formen; hier kommt dieselbe Wahl an die vorhandenen Merkmale.
--
-- Nur, wo noch keine Karte `Choices` steht — eine gefüllte hat jemand
-- angelegt und bleibt. Entfernt wird nichts.
-- Die Nummer wird beim Hereinmergen nachgesehen.

insert into component (entity_id, type, payload)
select m.entity_id, 'Choices',
       '{"choices":[{"id":"improvement","kind":"option","from":{"options":[{"key":"asi","label":"Increase ability scores"},{"key":"feat","label":"Take a feat instead"}]},"default":["asi"],"note":"Ability Score Improvement"},{"id":"ability-scores","kind":"ability","count":2,"bonus":[1,1],"repeat":true,"from":{"values":["str","dex","con","int","wis","cha"]},"onlyIf":{"choice":"improvement","pick":"asi"},"note":"+2 to one ability score or +1 to two"},{"id":"feat","kind":"feat","count":1,"from":{"interfaces":["Feat"]},"onlyIf":{"choice":"improvement","pick":"feat"},"note":"Feat"}]}'::jsonb
  from component m
  join component i on i.entity_id = m.entity_id and i.type = 'Identity'
  join component p on p.entity_id = m.entity_id and p.type = 'Prose'
 where m.type = '__meta'
   and m.payload->'interfaces'->>0 = 'Feature'
   and lower(i.payload->>'name') = 'ability score improvement'
   and p.payload::text ~* 'increases one ability score of your choice by 2'
on conflict (entity_id, type) do nothing;
