-- Abläufe und der Assistent (T-425, REQ-433, REQ-440, E-169, E-176): die
-- Spielerfigur bekommt die Maske `create` mit dem Element `builder` — „New
-- article“ führt dann in den Charakter-Assistenten, statt eine Figur ohne
-- Abstammung, Hintergrund und Klasse anzulegen. Die neuen Elementarten
-- `steps` und `builder` brauchen keine Zeile: sie sind Werte im Layout.
--
-- Hat die Spielerfigur schon eine eigene Maske `create`, bleibt sie.
-- Entfernt wird nichts.

update interface_def
   set views = coalesce(views, '{}'::jsonb) || '{"create":[{"id":"pc-builder","el":"builder"}]}'::jsonb
 where name = 'PlayerCharacter'
   and not (coalesce(views, '{}'::jsonb) ? 'create');
