-- Der Zugplan als Werkzeug der Karte (T-325).
--
-- `Campaign.turnPlanner`: was Spielende im Kampf planen — aus, nur
-- Bewegung, Bewegung und Aktionen, oder voll mit Reaktionen. Ohne Angabe
-- gilt `full`, wie bisher.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.
-- Die Nummer wird beim Hereinmergen nachgesehen.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,turnPlanner}',
         '{"type":"string","title":"Turn planner","description":"What players plan on the map during an encounter: off, movement only, movement and actions, or full with reactions.","enum":["off","move","actions","full"],"default":"full"}'::jsonb
       )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'turnPlanner');
