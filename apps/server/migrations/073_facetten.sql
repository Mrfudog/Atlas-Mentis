-- Facetten aus dem Register (T-174): wonach sich eine Liste filtern lässt,
-- wird aus den Feldern und Kanten einer Art abgeleitet. Wo die Ableitung
-- danebenliegt, sagt es `facet` am Feld (im Feldschema) oder an der Kante
-- (eigene Spalte, wie `means`).
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommen die Angaben
-- hier nach: „Revealed to", „Hidden from" und „Spot it in prose" sind kein
-- Filter. Geändert wird nur das Register; kein Artikel, nichts fällt weg.

alter table relation_def add column if not exists facet jsonb;

update interface_def
   set schema = jsonb_set(
         jsonb_set(schema::jsonb, '{properties,revealedTo,facet}', 'false'::jsonb),
         '{properties,hiddenFrom,facet}', 'false'::jsonb
       )::json
 where name = 'Visibility'
   and (schema::jsonb -> 'properties') ? 'revealedTo'
   and (schema::jsonb -> 'properties') ? 'hiddenFrom';

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,autolink,facet}', 'false'::jsonb)::json
 where name = 'Rule'
   and (schema::jsonb -> 'properties') ? 'autolink';
