-- Die Initiative als Regelsystem (T-334, E-100).
--
-- `Campaign.combat` bleibt `on`/`off` — bestehende Kampagnen sehen nichts
-- anders —, heisst aber „Initiative": `on` ist das System „D&D 5e
-- (standard)". Nur die Beschriftung; kein Artikel wird geändert.
-- Die Nummer wird beim Hereinmergen nachgesehen.

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,combat,title}', '"Initiative"'::jsonb)::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties' -> 'combat') = 'object'
   and (schema::jsonb -> 'properties' -> 'combat' ->> 'title') = 'Initiative tracker';
