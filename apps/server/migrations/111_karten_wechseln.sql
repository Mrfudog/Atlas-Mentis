-- Zwischen Karten wechseln in Play (T-308).
--
-- `Session.mapNavigation`: ob Spielende in Play in Unterkarten hinein- und
-- zur Karte darüber hinauszoomen dürfen, nur in freigegebene Karten der
-- Sitzung. Vorgabe aus.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.
-- Die Nummer wird beim Hereinmergen nachgesehen.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,mapNavigation}',
         '{"type":"boolean","title":"Players may change maps","default":false,"description":"In play, players may zoom into a sub-map or out to the map above — only into maps released in this session. Off: players stay on the map on the table."}'::jsonb
       )::json
 where name = 'Session'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'mapNavigation');
