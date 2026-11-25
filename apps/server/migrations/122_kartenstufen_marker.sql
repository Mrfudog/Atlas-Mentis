-- Marker zwischen Kartenstufen (T-328).
--
-- An der Kante `marker`: `stay` („Keep on this map“). Ein Marker im Bereich
-- einer Unterkarte ist dort ein Vorschlag zum Platzieren — gerechnet beim
-- Lesen (D8), gespeichert wird nur der Marker selbst; mit `stay` ist er auf
-- seiner Karte gemeint, und keine Unterkarte schlägt ihn vor.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.
-- Die Nummer wird beim Hereinmergen nachgesehen.

update relation_def
   set props = jsonb_set(
         props,
         '{properties}',
         (props -> 'properties')
           || jsonb_build_object('stay', '{"type":"boolean","title":"Keep on this map"}'::jsonb)
       )
 where type = 'marker'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not ((props -> 'properties') ? 'stay');
