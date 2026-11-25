-- Die Karte am Tisch (T-204): auf bestehenden Datenbanken nachziehen
-- (wie 082).
--
--  1. `Campaign.fog` — Nebel je Gruppe (`party`) oder je Figur (`player`).
--  2. `Campaign.moves` — Spielende ziehen ausserhalb eines Kampfes frei
--     oder mit Bestätigung der Leitung.
--  3. `Campaign.revealOnMove` — deckt ein Zug den Weg auf.
--  4. `Map.revealOnMove` — dasselbe an einer Karte, leer folgt der Kampagne.
--
-- Nur, wo schon ein Register steht; ergänzt wird nur, was fehlt. Nichts
-- wird entfernt, kein Artikel geändert.

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,fog}',
     '{"type":"string","title":"Fog of war","description":"Whether the whole party shares what is revealed, or each character sees only what it revealed itself.","enum":["party","player"],"default":"party"}'::jsonb
   )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties') ? 'fog';

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,moves}',
     '{"type":"string","title":"Player moves","description":"Outside an encounter: players move their tokens freely, or a move waits for the GM to confirm it.","enum":["free","confirm"],"default":"free"}'::jsonb
   )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties') ? 'moves';

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,revealOnMove}',
     '{"type":"boolean","title":"Moves reveal the way","description":"On a fogged map, a move uncovers the way the token went. A map may say otherwise.","default":false}'::jsonb
   )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties') ? 'revealOnMove';

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,revealOnMove}',
     '{"type":"boolean","title":"Moves reveal the way","description":"Overrides the campaign for this map: whether a move uncovers the way the token went. Empty follows the campaign."}'::jsonb
   )::json
 where name = 'Map'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties') ? 'revealOnMove';
