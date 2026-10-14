-- Testebene (T-176).
--
-- `Layer.kind` kennt das Wort `test`: eine Ebene zum Ausprobieren, die man
-- mit „Empty this layer" wieder leert. Beschreibung wie jedes Wort dort —
-- eine Regel hängt nicht daran. Der Seed schreibt nur in eine leere
-- Datenbank, also kommt es hier nach (wie `player` in 069).
--
-- Gelöscht wird nichts.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,kind,enum}',
         '["system","expansion","book","adventure","world","pack","campaign","player","test","overrides","group"]'::jsonb
       )::json
 where name = 'Layer'
   and (schema::jsonb #> '{properties,kind,enum}') is not null
   and not (schema::jsonb #> '{properties,kind,enum}') ? 'test';
