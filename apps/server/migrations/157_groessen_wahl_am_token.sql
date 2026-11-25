-- Überlappende Grössen-Zustände: die Leitung wählt am Token (T-428, E-164).
--
-- `marker.props.sizeSource`: die Id der Quelle, deren Grössen-Wirkung an
-- diesem Token gilt. Leer: die zuletzt hinzugekommene.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.

update relation_def
   set props = jsonb_set(
         props,
         '{properties,sizeSource}',
         '{"type":"string","title":"Size effect that applies"}'::jsonb
       )
 where type = 'marker'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not ((props -> 'properties') ? 'sizeSource');
