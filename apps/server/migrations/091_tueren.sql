-- Türen auf der Karte (T-118): auf bestehenden Datenbanken nachziehen
-- (wie 085).
--
--  1. `Campaign.doors` — öffnen Spielende Türen an ihrer Figur selbst
--     (`players`), oder nur die Leitung (`gm`).
--
-- Die Sperren selbst stehen schon in `Map.walls` (ein Feld ohne feste
-- Form); ihre Arten und der Türzustand sind Daten im Eintrag.
--
-- Nur, wo schon ein Register steht; ergänzt wird nur, was fehlt. Nichts
-- wird entfernt, kein Artikel geändert.

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,doors}',
     '{"type":"string","title":"Doors","description":"Who opens and closes doors on the map: players at a door next to their character, or only the GM. Locked doors stay shut either way.","enum":["players","gm"],"default":"players"}'::jsonb
   )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties') ? 'doors';
