-- Unterkarte am Raster der Karte darüber ausrichten (T-329).
--
-- An der Kante `insideMap`: `align` (Schalter „Align to parent grid“). Mit
-- ihm folgt die Grösse des Bereichs aus beiden Massstäben und die Lage
-- rastet am Raster ein — gerechnet beim Lesen (D8), `x`/`y`/`w`/`h` bleiben
-- die freie Lage und Grösse. Ohne Schalter bleibt jede Verknüpfung, wie sie
-- war.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo das Feld noch fehlt; nichts wird entfernt, kein Artikel geändert.
-- Die Nummer wird beim Hereinmergen nachgesehen.

update relation_def
   set props = jsonb_set(
         props,
         '{properties}',
         (props -> 'properties')
           || jsonb_build_object('align', '{"type":"boolean","title":"Align to parent grid"}'::jsonb)
       )
 where type = 'insideMap'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not ((props -> 'properties') ? 'align');
