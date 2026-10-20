-- Regeln am Tisch (REQ-357): `Campaign.ruleGraphs` — laufen die
-- Regelgraphen im Zugplan (`on`) oder nur im Regel-Builder (`off`, die
-- Vorgabe). Der Seed schreibt nur in eine leere Datenbank, also kommt das
-- Feld hier nach. Geändert wird nur das Register.
--
-- Nichts fällt weg.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,ruleGraphs}',
         '{"type":"string","title":"Rules from graphs","enum":["off","on"],"default":"off"}'::jsonb
       )::json
 where name = 'Campaign'
   and (schema::jsonb -> 'properties') ? 'playerRolls'
   and not (schema::jsonb -> 'properties') ? 'ruleGraphs';
