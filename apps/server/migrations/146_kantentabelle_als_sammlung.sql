-- „Table from edges" (`edgeTable`, T-281) ist eine Collection als Tabelle
-- (T-425, Schnitt 3): dieselben Zeilen — je Artikel am Ende des Pfads eine,
-- mit den Werten der Kante (`props`) und den genannten Feldern (`fields`)
-- als Spalten. Ein Element, nicht zwei, die dasselbe können.
--
-- Umgestellt wird jedes `edgeTable` in einer Ansicht oder in der Anordnung
-- einer Art, auch in Behältern und Reitern: aus `"el": "edgeTable"` wird
-- `"el": "collection", "show": "table"`. Pfad, Spalten, Titel und Id
-- bleiben; kein Artikel wird geändert, keine Kante fällt weg. Der Zeichner
-- kennt `edgeTable` weiter, für Registerdateien von früher.

update view_def
   set config = replace(config::text, '"el": "edgeTable"', '"el": "collection", "show": "table"')::jsonb
 where config::text like '%"el": "edgeTable"%';

update interface_def
   set views = replace(views::text, '"el": "edgeTable"', '"el": "collection", "show": "table"')::jsonb
 where views::text like '%"el": "edgeTable"%';
