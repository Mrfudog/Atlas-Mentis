-- `Recipe.checks` auf bestehenden Datenbanken nachziehen (T-122; wie 055–057).
--
-- Wie viele gelungene Proben ein Rezept braucht: Kibbles’ Compendium zählt
-- Fortschritt in Proben je zwei Stunden. Der Seed füllt eine Datenbank, die
-- schon Arten hat, nicht nach — darum hier. Ergänzt wird nur, was fehlt;
-- kein Artikel wird geändert.

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,checks}',
     '{"type":"number","title":"Crafting checks","min":1}'::jsonb
   )::json
 where name = 'Recipe'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not (schema::jsonb -> 'properties') ? 'checks';
