-- Werkzeuge je Kartentyp (T-320).
--
-- `Campaign.mapTools`: je `Map.kind` die Gruppen der Werkzeugleiste. Ohne
-- Angabe gilt die Vorgabe (Kampfkarten: Wände, Nebel, Licht, Gitter,
-- Tokens, Assets, Marker; alle anderen: Unterkarten, Marker, Assets).
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.
-- Die Nummer wird beim Hereinmergen nachgesehen.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,mapTools}',
         '{"type":"object","title":"Map tools","description":"Which tool groups the map shows for each map kind. A kind left out keeps the default: walls, fog, light, grid, tokens, assets and markers on battle maps; sub-map links, markers and assets on the others."}'::jsonb
       )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'mapTools');
