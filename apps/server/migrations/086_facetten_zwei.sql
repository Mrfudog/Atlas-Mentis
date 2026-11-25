-- Facetten Teil 2 (T-180): Voraussetzungen und Wirkungen als Facette.
--
-- `facet: {as: 'requirement'}` liest einen Satz („level 4, STR 13") als
-- prüfbare Voraussetzung (Talent, Einstimmung, Mehrklassen-Einstieg),
-- `facet: {as: 'effect'}` die Einträge von `Effects.effects`. Talent und
-- Merkmal nehmen `Effects` dazu: `effectsAt` liest ihre Wirkungen schon,
-- nur hatte keines das Feld.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Geändert wird nur das Register; kein Artikel, nichts fällt weg.

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,prerequisite,facet}', '{"as":"requirement"}'::jsonb)::json
 where name = 'Feat'
   and (schema::jsonb -> 'properties') ? 'prerequisite';

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,multiclassRequirement,facet}', '{"as":"requirement"}'::jsonb)::json
 where name = 'Class'
   and (schema::jsonb -> 'properties') ? 'multiclassRequirement';

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,attunementNote,facet}', '{"as":"requirement"}'::jsonb)::json
 where name = 'Item'
   and (schema::jsonb -> 'properties') ? 'attunementNote';

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,effects,facet}', '{"as":"effect"}'::jsonb)::json
 where name = 'Effects'
   and (schema::jsonb -> 'properties') ? 'effects';

update interface_def
   set extends = extends || array['Effects']
 where name in ('Feat', 'Feature') and not ('Effects' = any(extends));
