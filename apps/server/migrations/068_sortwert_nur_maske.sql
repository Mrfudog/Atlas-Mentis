-- `Time.sort` und `Time.untilSort` stehen nur in der Maske (T-126, F14):
-- ein Schlüssel zum Ordnen, den niemand liest — in der Feldtabelle stand
-- „Sortable value 14920512" an jedem Ereignis.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt die Angabe
-- hier nach. Geändert wird nur das Feldschema; kein Artikel, nichts fällt
-- weg.

update interface_def
   set schema = jsonb_set(
         jsonb_set(schema::jsonb, '{properties,sort,editOnly}', 'true'::jsonb),
         '{properties,untilSort,editOnly}', 'true'::jsonb
       )::json
 where name = 'Time'
   and (schema::jsonb -> 'properties') ? 'sort'
   and (schema::jsonb -> 'properties') ? 'untilSort'
   and not coalesce((schema::jsonb #> '{properties,sort,editOnly}')::text = 'true', false);
