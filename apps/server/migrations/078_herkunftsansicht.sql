-- Die Herkunftsansicht (T-166) liest `subraceOf`: die Seite einer Herkunft
-- führt ihre Unterarten als Leiste zum Umschalten und Vergleichen. Die
-- Kante verspricht also nichts mehr, was niemand liest (T-111).
--
-- Geändert wird nur das Register. Nichts fällt weg.

update relation_def set intended = null where type = 'subraceOf' and intended is not null;
