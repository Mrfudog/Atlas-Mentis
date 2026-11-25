-- Woher ein Preis kommt (T-139, E-046): `Item.priceNote`.
--
-- Leer heisst Listenpreis der Quelle; sonst ein Satz wie „estimated: DMG
-- 2024 rare" oder „derived: base price + 100 gp". Der Seed schreibt nur in
-- eine leere Datenbank, also kommt das Feld hier nach — nur, wo schon ein
-- Register steht. Ergänzt wird nur, was fehlt; kein Artikel ändert sich.

update interface_def
   set schema = (
     schema::jsonb || jsonb_build_object('properties', (schema::jsonb -> 'properties') || '{
       "priceNote":{"type":"string","title":"Price basis"}
     }'::jsonb)
   )::json
 where name = 'Item'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties') ? 'priceNote';
