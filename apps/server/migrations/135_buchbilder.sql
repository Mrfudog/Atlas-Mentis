-- Bilder im Buch- und Abenteuertext als Teile (T-210).
--
-- Ein Bild im Text eines Buchs wird ein eigener Teil, `Illustration`
-- (`BookPart` mit `Image`): Bildunterschrift und Alternativtext stehen an
-- der Stelle im Buch, die Datei kommt mit dem Hochladen (T-284) in
-- `Image.image`. Eingeordnet wird über `partOf.props.rank` als Bruch
-- hinter dem Teil davor — die Teile, die schon stehen, bleiben, wie sie
-- sind.
--
-- Nur, wo schon ein Register steht (wie 043). Entfernt wird nichts.

insert into interface_def (name, label, abstract, extends, schema, area)
select 'Illustration', 'Illustration', false, array['BookPart','Image'], null::json, null
 where exists (select 1 from interface_def)
on conflict (name) do nothing;
