-- Legendary Actions im Lair (T-437, REQ-364).
--
-- `Statblock.legendaryActionsLair`: neuere Statblöcke nennen im Lair mehr
-- („3 (4 in Lair)"). Der Importer schreibt es jetzt; bisher ging die Zahl
-- verloren.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,legendaryActionsLair}',
         '{"type":"number","min":1,"title":"Legendary actions in lair"}'::jsonb
       )::json
 where name = 'Statblock'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'legendaryActionsLair');
