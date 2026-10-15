-- Vorplatzieren auf der Karte (T-203): auf bestehenden Datenbanken
-- nachziehen (wie 082).
--
--  `marker.props.encounter` — das Token steht für diese Begegnung bereit,
--  versteckt, bis „Start encounter" sie beginnt.
--
-- Nur, wo schon ein Register steht; ergänzt wird nur, was fehlt. Nichts
-- wird entfernt, kein Artikel geändert.

update relation_def
   set props = jsonb_set(
     props,
     '{properties,encounter}',
     '{"type":"string","format":"link","target":{"interfaces":["Encounter"]},"title":"Prepared for encounter"}'::jsonb
   )
 where type = 'marker'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not (props -> 'properties') ? 'encounter';
