-- Listen, die die Leitung pflegt, und „frei mit Vorschlag" (T-423).
--
--  1. Die Aufzählungszeile `PlaceKind` (Registry › Lists) — mit den Werten,
--     die `Place.kind` heute an seinem Feld trägt (auch wenn jemand sie
--     im Register schon angepasst hat), sonst mit den sieben der Vorgabe.
--  2. `Place.kind` nennt die Zeile mit `enumRef` und `suggest`: die Liste
--     schlägt vor, ein eigenes Wort darf stehen. Nur, wo das Feld noch
--     seine eigene Liste trägt.
--  3. `Encounter.kind` bekommt `suggest` — die Zeile `EncounterKind`
--     schlägt vor und hält nicht mehr.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Kein Wert fällt weg, kein Artikel wird geändert: was in einem Ort oder
-- einer Begegnung steht, galt vorher und gilt danach.

insert into enum_def (name, config)
select 'PlaceKind',
       jsonb_build_object(
         'name', 'PlaceKind',
         'label', 'Place type',
         'values', coalesce(
           (select i.schema::jsonb -> 'properties' -> 'kind' -> 'enum'
              from interface_def i
             where i.name = 'Place'
               and jsonb_typeof(i.schema::jsonb -> 'properties' -> 'kind' -> 'enum') = 'array'),
           '["Reich","Stadt","Distrikt","Gasse","Gebäude","Raum","Wildnis"]'::jsonb
         )
       )
 where exists (select 1 from enum_def)
on conflict (name) do nothing;

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,kind}',
         ((schema::jsonb -> 'properties' -> 'kind') - 'enum')
           || '{"enumRef":"PlaceKind","suggest":true}'::jsonb
       )::json
 where name = 'Place'
   and jsonb_typeof(schema::jsonb -> 'properties' -> 'kind' -> 'enum') = 'array'
   and not (schema::jsonb -> 'properties' -> 'kind') ? 'enumRef';

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,kind,suggest}',
         'true'::jsonb
       )::json
 where name = 'Encounter'
   and schema::jsonb -> 'properties' -> 'kind' ->> 'enumRef' = 'EncounterKind'
   and not (schema::jsonb -> 'properties' -> 'kind') ? 'suggest';
