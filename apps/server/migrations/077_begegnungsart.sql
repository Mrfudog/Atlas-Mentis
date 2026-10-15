-- Begegnungen haben eine Art (T-178, REQ-085): Kampf, Gespräch, Rätsel,
-- Erkundung, Gefahr, Falle, Ressource, Geschichte.
--
--  1. Die Aufzählungszeile `EncounterKind`.
--  2. Das Feld `Encounter.kind` (mehrere Werte aus der Zeile).
--  3. Die Übersicht der Begegnung zeigt Art und Phase — nur, wo sie noch
--     keine eigene hat.
--  4. Bestehende Begegnungen: `combat`, wo jemand mitkämpft
--     (`participates`) — das ist heute die Initiative. Die übrigen bleiben
--     leer; „nicht gesagt“ ist etwas anderes als „Kampf“. Eine schon
--     gesetzte Art bleibt.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt das hier nach.
-- Nichts fällt weg.

insert into enum_def (name, config)
values ('EncounterKind', '{"name":"EncounterKind","label":"Encounter kind","values":["combat","social","puzzle","exploration","hazard","trap","resource","story"]}'::jsonb)
on conflict (name) do nothing;

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,kind}',
         '{"type":"array","title":"Kind","items":{"type":"string"},"enumRef":"EncounterKind"}'::jsonb
       )::json
 where name = 'Encounter'
   and (schema::jsonb -> 'properties') ? 'xpBudget'
   and not (schema::jsonb -> 'properties') ? 'kind';

update interface_def
   set views = coalesce(views, '{}'::jsonb)
               || '{"overview":[{"id":"e-ov","el":"fields","fields":["Encounter.kind","Encounter.phase"]}]}'::jsonb
 where name = 'Encounter'
   and (views is null or not views ? 'overview');

insert into component (entity_id, type, payload)
select distinct r.from_id, 'Encounter', '{"kind":["combat"]}'::jsonb
  from relation r
 where r.type = 'participates'
   and exists (select 1 from component c where c.entity_id = r.from_id and c.type = '__meta'
                 and c.payload->'interfaces' ? 'Encounter')
on conflict (entity_id, type) do update
   set payload = component.payload || '{"kind":["combat"]}'::jsonb
 where not (component.payload ? 'kind');
