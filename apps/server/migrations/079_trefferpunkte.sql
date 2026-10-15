-- Trefferpunkte im Assistenten (T-194): auf bestehenden Datenbanken
-- nachziehen (wie 070).
--
--  1. `Campaign.hitPoints` — würfeln, Durchschnitt oder je Stufe wählen.
--     Ohne Angabe wählen.
--  2. `hasClass.props.hp` — was der Trefferwürfel je Stufe brachte.
--
-- Nur, wo schon ein Register steht; ergänzt wird nur, was fehlt. Nichts
-- wird entfernt, kein Artikel geändert.

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,hitPoints}',
     '{"type":"string","title":"Hit points per level","enum":["either","average","roll"],"default":"either"}'::jsonb
   )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties') ? 'hitPoints';

update relation_def
   set props = jsonb_set(
     props,
     '{properties,hp}',
     '{"type":"array","items":{"type":"number"},"title":"Hit points per level"}'::jsonb
   )
 where type = 'hasClass'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not (props -> 'properties') ? 'hp';
